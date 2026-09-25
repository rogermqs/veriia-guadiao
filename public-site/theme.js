(function () {
  var media = matchMedia("(prefers-color-scheme: dark)");
  function saved() {
    try {
      return localStorage.getItem("guardiao-theme");
    } catch (_) {
      return null;
    }
  }
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    var button = document.querySelector(".site-theme-toggle");
    if (button) {
      button.textContent = theme === "dark" ? "☀ Claro" : "☾ Escuro";
      button.setAttribute(
        "aria-label",
        theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro",
      );
    }
  }
  function sync() {
    var value = saved();
    apply(
      value === "dark" || value === "light"
        ? value
        : media.matches
          ? "dark"
          : "light",
    );
  }
  sync();
  media.addEventListener("change", sync);
  document.addEventListener("DOMContentLoaded", function () {
    sync();
    var button = document.querySelector(".site-theme-toggle");
    if (button)
      button.addEventListener("click", function () {
        var theme =
          document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        try {
          localStorage.setItem("guardiao-theme", theme);
        } catch (_) {}
        apply(theme);
      });
  });
})();
