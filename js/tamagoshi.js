// js/tamagoshi.js

const Tamagoshi = {
  imgEl: null,
  textEl: null,
  
  // Caminhos das imagens sem fundo
  states: {
    normal:     { img: 'assets/tamagoshi/normal.png',     text: 'Pronto para o dia! ✨' },
    focado:     { img: 'assets/tamagoshi/focado.png',     text: 'Focado nas demandas 🚀' },
    estressado: { img: 'assets/tamagoshi/estressado.png', text: 'Muitas tarefas! 🤯' },
    dormindo:   { img: 'assets/tamagoshi/dormindo.png',   text: 'Zzz... recarregando 🌙' }
  },

  init() {
    this.imgEl = document.getElementById('tamaImg');
    this.textEl = document.getElementById('tamaBubble');
    if (!this.imgEl || !this.textEl) return;

    this.update();
    // Atualiza o humor a cada 1 minuto
    setInterval(() => this.update(), 60000);
  },

  update() {
    const hora = new Date().getHours();
    let state = 'normal';

    // 1. Verifica se é noite (das 20h às 05h)
    if (hora >= 20 || hora < 6) {
      state = 'dormindo';
    } else {
      // 2. Calcula a carga de trabalho (Tarefas + Kanban Ativos)
      const tasks = JSON.parse(localStorage.getItem('hubnexus_tasks') || '[]');
      const kanban = JSON.parse(localStorage.getItem('hubnexus_kanban') || '[]');
      
      const ativasTasks = tasks.filter(t => !t.done).length;
      const ativasKanban = kanban.filter(k => k.col !== 'concluido').length;
      const totalAtivas = ativasTasks + ativasKanban;

      if (totalAtivas <= 3) {
        state = 'normal';
      } else if (totalAtivas <= 8) {
        state = 'focado';
      } else {
        state = 'estressado';
      }
    }

    // Aplica a imagem e o texto
    this.imgEl.src = this.states[state].img;
    this.textEl.textContent = this.states[state].text;
  }
};

// Inicia assim que a página carrega
document.addEventListener('DOMContentLoaded', () => {
  Tamagoshi.init();
});
