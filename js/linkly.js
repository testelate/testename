// js/linkly.js — Integração e Lógica do Encurtador Linkly

function getShortUrl(shortCode) {
  let baseOrigin = window.location.origin;
  const hostname = window.location.hostname;
  if (hostname.endsWith('.pages.dev')) {
    baseOrigin = 'https://hub-nexus.pages.dev';
  }
  return baseOrigin + `/l/${shortCode}`;
}

document.addEventListener('DOMContentLoaded', () => {
  // Inicializa tema e modo do hub a partir do localStorage
  if (typeof initMode === 'function') initMode();
  if (typeof initTheme === 'function') initTheme();

  const urlParams = new URLSearchParams(window.location.search);
  const isEmbed = urlParams.get('embed') === 'true';

  // Verifica se está rodando no iframe ou standalone
  if (isEmbed) {
    document.body.classList.add('is-embedded');
  } else {
    // Renderiza a navbar nativa se estiver standalone
    const navContainer = document.getElementById('navbar-container');
    if (navContainer && typeof renderNavbar === 'function') {
      navContainer.innerHTML = renderNavbar('linkly');
      if (typeof setNavLabel === 'function') {
        setNavLabel('Linkly');
      }
    }
  }

  // Resgata o email do usuário logado
  let userEmail = '';
  try {
    const auth = JSON.parse(localStorage.getItem('hubnexus-auth') || '{}');
    userEmail = auth.email || '';
  } catch (e) {
    console.error('Erro ao ler dados de autenticação:', e);
  }

  const originalUrlInput = document.getElementById('originalUrlInput');
  const shortenBtn = document.getElementById('shortenBtn');
  const resultBox = document.getElementById('resultBox');
  const shortenedUrlInput = document.getElementById('shortenedUrlInput');
  const copyBtn = document.getElementById('copyBtn');
  const mascot = document.getElementById('linklyMascot');

  // Carrega o histórico de links do usuário
  loadHistory(userEmail);

  // Lógica do Balão de Fala do Mascote (Estilo Nexinho)
  let mascotIdx = 0;
  const mascotMsgs = [
    "Este é o Linkly, o encurtador de links oficial do HUB.nexus. Cole a sua URL longa no campo abaixo para gerar uma versão encurtada e rastreável.",
    "Os links curtos gerados ajudam a simplificar a leitura e tornam os relatórios de monitoramento mais limpos e profissionais.",
    "Todos os cliques nos links encurtados são registrados pelo banco de dados e exibidos em tempo real na tabela de histórico abaixo.",
    "Quando integrado ao Sentinela, o link encurtado é retornado automaticamente para preencher o formulário de publicação da página.",
    "Você pode clicar no mascote ou neste balão de fala a qualquer momento para alternar entre as informações de uso do sistema."
  ];

  function mascotSetMsg(idx) {
    const textEl = document.getElementById('mascotText');
    if (textEl) {
      textEl.style.opacity = 0;
      setTimeout(() => {
        textEl.textContent = mascotMsgs[idx];
        textEl.style.opacity = 1;
      }, 150);
    }
    mascotIdx = idx;
  }

  window.mascotNextMsg = function() {
    mascotSetMsg((mascotIdx + 1) % mascotMsgs.length);
  };

  const bubbleEl = document.getElementById('mascotBubble');
  if (bubbleEl) {
    bubbleEl.style.display = 'block'; // Mostra o balão se ele existir no DOM
    bubbleEl.addEventListener('click', window.mascotNextMsg);
    // Inicializa a primeira mensagem
    setTimeout(() => mascotSetMsg(0), 300);
    // Cicla mensagens a cada 8 segundos (igual ao Nexinho)
    setInterval(window.mascotNextMsg, 8000);
  }

  // Animação/easter egg do mascote tartaruga ao clicar
  if (mascot) {
    mascot.addEventListener('click', () => {
      mascot.style.transform = 'scale(1.25) rotate(15deg)';
      setTimeout(() => {
        mascot.style.transform = '';
      }, 300);
      window.mascotNextMsg(); // Também avança a mensagem ao clicar na tartaruga
    });
  }

  // Ação de Encurtar
  shortenBtn.addEventListener('click', async () => {
    const url = (originalUrlInput.value || '').trim();
    if (!url) {
      alert('Por favor, informe a URL original.');
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      alert('A URL deve iniciar com http:// ou https://.');
      return;
    }

    shortenBtn.disabled = true;
    const originalText = shortenBtn.textContent;
    shortenBtn.textContent = 'Encurtando...';

    try {
      const response = await fetch('/api/linkly/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_url: url, created_by: userEmail })
      });
      const data = await response.json();
      
      if (data.ok && data.short_code) {
        const shortUrl = getShortUrl(data.short_code);
        shortenedUrlInput.value = shortUrl;
        resultBox.style.display = 'flex';
        originalUrlInput.value = '';

        // Se estiver em modo iframe/embed, envia mensagem de volta à janela pai
        if (isEmbed && window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'linkly:shortened',
            shortUrl: shortUrl
          }, '*');
        }

        // Recarrega o histórico
        loadHistory(userEmail);
      } else {
        alert('Erro ao encurtar o link: ' + (data.error || 'resposta inválida'));
      }
    } catch (err) {
      console.error('Erro na requisição /api/linkly/create:', err);
      alert('Erro de rede ao encurtar o link.');
    } finally {
      shortenBtn.disabled = false;
      shortenBtn.textContent = originalText;
    }
  });

  // Copiar link curto
  copyBtn.addEventListener('click', () => {
    if (!shortenedUrlInput.value) return;
    shortenedUrlInput.select();
    navigator.clipboard.writeText(shortenedUrlInput.value).then(() => {
      const originalCopyText = copyBtn.textContent;
      copyBtn.textContent = 'Copiado!';
      setTimeout(() => {
        copyBtn.textContent = originalCopyText;
      }, 1500);
    }).catch(err => {
      console.error('Erro ao copiar para a área de transferência:', err);
      alert('Não foi possível copiar automaticamente. Selecione e copie manualmente.');
    });
  });
});

// Carrega histórico de links
async function loadHistory(email) {
  const bodyTable = document.getElementById('historyTableBody');
  if (!bodyTable) return;

  try {
    const url = email ? `/api/linkly/list?created_by=${encodeURIComponent(email)}` : '/api/linkly/list';
    const response = await fetch(url);
    const data = await response.json();

    if (data.ok && data.links && data.links.length > 0) {
      bodyTable.innerHTML = data.links.map(link => {
        const date = link.created_at ? new Date(link.created_at).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : '-';
        const shortUrl = getShortUrl(link.short_code);
        return `
          <tr>
            <td title="${escapeHtml(link.original_url)}">
              <a href="${escapeHtml(link.original_url)}" target="_blank">${escapeHtml(link.original_url)}</a>
            </td>
            <td>
              <div class="short-link-container">
                <a href="${shortUrl}" target="_blank">${shortUrl}</a>
                <button class="delete-link-btn" onclick="confirmDeleteLink('${link.short_code}', event)" title="Excluir link">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
              </div>
            </td>
            <td>${link.clicks || 0}</td>
            <td>${date}</td>
          </tr>
        `;
      }).join('');
    } else {
      bodyTable.innerHTML = `<tr><td colspan="4" class="empty-state">Nenhum link encurtado ainda.</td></tr>`;
    }
  } catch (err) {
    console.error('Erro ao buscar histórico de links:', err);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.confirmDeleteLink = async function(shortCode, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  if (!confirm('Deseja realmente excluir este link encurtado?')) {
    return;
  }
  
  let email = '';
  try {
    const auth = JSON.parse(localStorage.getItem('hubnexus-auth') || '{}');
    email = auth.email || '';
  } catch (e) {}

  try {
    const response = await fetch('/api/linkly/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ short_code: shortCode, email: email })
    });
    const data = await response.json();
    if (data.ok) {
      if (typeof showToast === 'function') {
        showToast('Link excluído com sucesso!');
      } else {
        alert('Link excluído com sucesso!');
      }
      loadHistory(email);
    } else {
      const errorMsg = data.error || 'Erro desconhecido';
      if (typeof showToast === 'function') {
        showToast('Erro ao excluir: ' + errorMsg);
      } else {
        alert('Erro ao excluir: ' + errorMsg);
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast('Erro ao se conectar com o servidor.');
    } else {
      alert('Erro de rede ao tentar excluir.');
    }
  }
};
