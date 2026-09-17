fetch("/api/me", { credentials: "same-origin" })
  .then((response) => (response.ok ? response.json() : null))
  .then((user) => {
    const status = document.getElementById("status");
    
    if (user) {
      status.textContent = `Sessão de ${user.email ?? user.displayName}.`;
      status.classList.replace("alert-secondary", "alert-success");
    } else {
      status.textContent = "Nenhuma sessão neste navegador.";
      status.classList.replace("alert-secondary", "alert-warning");
    }
  })
  .catch((error) => {
    console.error("Erro ao buscar a sessão:", error);
  });