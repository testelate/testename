// Arquivo: functions/utils/whatsapp.js

export async function enviarAlertaWhatsApp(numeroDestino, apiKey, mensagem) {
  // Se o usuário não preencheu os dados no perfil, a gente ignora e não quebra o sistema
  if (!numeroDestino || !apiKey) {
    console.log("Usuário não configurou o WhatsApp ou faltam credenciais.");
    return false; 
  }

  try {
    // É OBRIGATÓRIO encodar o texto para que espaços, quebras de linha e emojis funcionem na URL
    const textoEncodado = encodeURIComponent(mensagem);
    
    // Montamos a URL da API do CallMeBot
    const urlCallMeBot = `https://api.callmebot.com/whatsapp.php?phone=${numeroDestino}&text=${textoEncodado}&apikey=${apiKey}`;

    // O Cloudflare Worker faz a requisição GET para o bot
    const resposta = await fetch(urlCallMeBot, {
      method: "GET"
    });

    if (resposta.ok) {
      console.log(`Notificação enviada com sucesso para ${numeroDestino}!`);
      return true;
    } else {
      const erroBot = await resposta.text();
      console.error("Erro na API do CallMeBot:", erroBot);
      return false;
    }
  } catch (erro) {
    console.error("Erro interno no Cloudflare ao enviar Zap:", erro.message);
    return false;
  }
}
