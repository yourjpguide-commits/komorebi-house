import "./style.css";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root");
}

root.innerHTML = `
  <main class="boot-shell" data-testid="game-root">
    <section class="boot-card" aria-label="Komorebi House loading">
      <div class="boot-mark" aria-hidden="true">木</div>
      <p class="boot-kicker">A tiny place for quiet days</p>
      <h1>Komorebi House</h1>
      <p>Preparing the tatami…</p>
    </section>
  </main>
`;

void import("./game/bootstrap").then(({ bootstrapGame }) => bootstrapGame(root));
