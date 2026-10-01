const $ = (id) => document.getElementById(id);
const CORES = ["#3d7cff", "#8e44ad", "#e67e22", "#16a085", "#c0392b", "#2c3e50", "#d35400", "#27ae60"];
const CHAVE = "selecao-jogos";

const estado = {
  selecionados: new Set(),
  console: CONSOLES[0].id,
  ocupado: 0,
};

// ---------- salvar / carregar escolha do cliente ----------
function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({
      selecionados: [...estado.selecionados],
      console: estado.console,
      ocupado: estado.ocupado,
      nome: $("nome").value,
    }));
  } catch (e) {}
}
function carregar() {
  try {
    const d = JSON.parse(localStorage.getItem(CHAVE));
    if (!d) return;
    const ids = new Set(JOGOS.map((j) => j.id));
    estado.selecionados = new Set((d.selecionados || []).filter((id) => ids.has(id)));
    if (CONSOLES.some((c) => c.id === d.console)) estado.console = d.console;
    estado.ocupado = Number(d.ocupado) || 0;
    $("nome").value = d.nome || "";
  } catch (e) {}
}

// ---------- cálculos ----------
const consoleAtual = () => CONSOLES.find((c) => c.id === estado.console);
const jogosSelecionados = () => JOGOS.filter((j) => estado.selecionados.has(j.id));
const somaJogos = () => jogosSelecionados().reduce((t, j) => t + j.tamanho, 0);
const livre = () => consoleAtual().util - estado.ocupado - somaJogos();
const gb = (n) => `${Number(n.toFixed(1)).toLocaleString("pt-BR")} GB`;
const real = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function sigla(titulo) {
  return titulo.replace(/[^\p{L}\p{N} ]/gu, "").split(" ").filter(Boolean)
    .slice(0, 3).map((p) => p[0]).join("").toUpperCase();
}
function cor(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CORES[h % CORES.length];
}

// ---------- catálogo ----------
function renderCatalogo() {
  const busca = $("busca").value.trim().toLowerCase();
  // com algo digitado na busca, "Melhores" não limita: procura no catálogo todo
  const genero = busca && $("genero").value === "*melhores" ? "" : $("genero").value;
  const ordem = $("ordem").value;
  const espacoLivre = livre();

  let lista = JOGOS.filter((j) =>
    (!busca || j.titulo.toLowerCase().includes(busca)) &&
    (!genero || (genero === "*melhores" ? j.ranking : j.genero === genero))
  );
  $("contagem").textContent = `${lista.length} de ${JOGOS.length} jogos`;
  lista.sort((a, b) =>
    ordem === "menor" ? a.tamanho - b.tamanho :
    ordem === "maior" ? b.tamanho - a.tamanho :
    genero === "*melhores" ? a.ranking - b.ranking :
    a.titulo.localeCompare(b.titulo, "pt-BR")
  );

  const grade = $("grade");
  grade.innerHTML = "";
  if (!lista.length) {
    grade.innerHTML = `<p class="vazio">Nenhum jogo encontrado.</p>`;
    return;
  }

  for (const j of lista) {
    const sel = estado.selecionados.has(j.id);
    const cabe = sel || j.tamanho <= espacoLivre;
    const card = document.createElement("article");
    card.className = "jogo" + (sel ? " sel" : "");
    card.innerHTML = `
      <div class="capa" style="background:${cor(j.id)}">
        ${sigla(j.titulo)}
        ${j.capa ? `<img src="${j.capa}" alt="" loading="lazy" onerror="this.remove()">` : ""}
        ${j.gratuito ? `<span class="tag">GRÁTIS</span>` : ""}
        ${j.ranking ? `<span class="rank" title="Entre os mais vendidos do PS4">★ ${j.ranking}º</span>` : ""}
      </div>
      <div class="info">
        <h3></h3>
        <div class="meta">${j.genero} · <b>${gb(j.tamanho)}</b></div>
        <button ${cabe ? "" : "disabled"}>${sel ? "Remover" : cabe ? "Adicionar" : "Não cabe"}</button>
      </div>`;
    card.querySelector("h3").textContent = j.titulo;
    card.querySelector("button").onclick = () => alternar(j.id);
    grade.appendChild(card);
  }
}

function alternar(id) {
  if (estado.selecionados.has(id)) estado.selecionados.delete(id);
  else estado.selecionados.add(id);
  atualizar();
}

// ---------- painel ----------
function renderPainel() {
  const total = consoleAtual().util;
  const soma = somaJogos();
  const sobra = livre();
  const ocupadoPct = Math.min(100, (estado.ocupado / total) * 100);
  const jogosPct = Math.min(100 - ocupadoPct, (soma / total) * 100);
  const usoPct = ((estado.ocupado + soma) / total) * 100;

  $("barra-ocupado").style.width = ocupadoPct + "%";
  $("barra-jogos").style.width = jogosPct + "%";
  const barra = document.querySelector(".barra");
  barra.classList.toggle("cheio", sobra < 0);
  barra.classList.toggle("alerta", sobra >= 0 && usoPct > 90);

  const txt = $("espaco-texto");
  if (sobra < 0) {
    txt.textContent = `Passou ${gb(-sobra)} do limite. Remova algum jogo.`;
    txt.className = "espaco-texto erro";
  } else {
    txt.textContent = `Jogos: ${gb(soma)} · Ainda sobram ${gb(sobra)} de ${gb(total)}`;
    txt.className = "espaco-texto";
  }

  const sel = jogosSelecionados();
  $("qtd").textContent = sel.length;
  const ul = $("lista");
  ul.innerHTML = "";
  if (!sel.length) ul.innerHTML = `<li class="nada">Nenhum jogo escolhido ainda.</li>`;
  for (const j of sel) {
    const li = document.createElement("li");
    li.innerHTML = `<div></div><span>${gb(j.tamanho)}</span><button aria-label="Remover">✕</button>`;
    li.firstChild.textContent = j.titulo;
    li.querySelector("button").onclick = () => alternar(j.id);
    ul.appendChild(li);
  }

  const taxa = valorServico();
  const conta = CONFIG.taxaServico ? real(taxa) :
    `${sel.length} jogo${sel.length === 1 ? "" : "s"} × ${real(CONFIG.taxaPorJogo)} = ${real(taxa)}`;
  $("taxa").textContent = taxa && sel.length ? `Serviço de instalação: ${conta}` : "";

  $("enviar").disabled = !sel.length || sobra < 0 || !$("nome").value.trim();

  // barra fixa no celular
  $("mini-fill").style.width = Math.min(100, usoPct) + "%";
  $("mini").classList.toggle("cheio", sobra < 0);
  $("mini-texto").textContent = `${sel.length} jogo${sel.length === 1 ? "" : "s"} · ${sobra < 0 ? "passou do limite" : "sobram " + gb(sobra)}`;
}

function valorServico() {
  const n = jogosSelecionados().length;
  return n ? CONFIG.taxaServico + CONFIG.taxaPorJogo * n : 0;
}

// ---------- pedido ----------
function enviarPedido() {
  const sel = jogosSelecionados();
  const linhas = [
    `*Pedido de instalação — ${CONFIG.nomeLoja}*`,
    ``,
    `Cliente: ${$("nome").value.trim()}`,
    `Console: ${consoleAtual().nome}`,
    `Espaço já usado: ${gb(estado.ocupado)}`,
    ``,
    `*Jogos (${sel.length}):*`,
    ...sel.map((j) => `• ${j.titulo} — ${gb(j.tamanho)}${j.gratuito ? " (grátis)" : ""}`),
    ``,
    `Total dos jogos: ${gb(somaJogos())}`,
    `Espaço que vai sobrar: ${gb(livre())}`,
  ];
  if (valorServico()) linhas.push(`Serviço de instalação: ${real(valorServico())}`);
  linhas.push(``, `Os jogos serão comprados na minha conta PSN.`);
  window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(linhas.join("\n"))}`, "_blank");
}

function atualizar() {
  renderCatalogo();
  renderPainel();
  salvar();
}

// ---------- início ----------
function iniciar() {
  document.title = `${CONFIG.nomeLoja} — Escolha seus jogos`;
  $("nome-loja").textContent = CONFIG.nomeLoja;
  if (CONFIG.instagram) {
    $("insta").href = `https://instagram.com/${CONFIG.instagram}`;
    $("insta").textContent = `@${CONFIG.instagram} no Instagram`;
    $("insta").hidden = false;
  }

  const generos = [...new Set(JOGOS.map((j) => j.genero))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  $("genero").innerHTML = `<option value="*melhores" selected>★ Melhores (mais vendidos)</option><option value="">Todos os jogos</option>` +
    generos.map((g) => `<option>${g}</option>`).join("");
  $("console").innerHTML = CONSOLES.map((c) => `<option value="${c.id}">${c.nome}</option>`).join("");

  carregar();
  $("console").value = estado.console;
  $("ocupado").value = estado.ocupado;

  $("busca").oninput = renderCatalogo;
  $("genero").onchange = renderCatalogo;
  $("ordem").onchange = renderCatalogo;
  $("console").onchange = (e) => { estado.console = e.target.value; atualizar(); };
  $("ocupado").oninput = (e) => { estado.ocupado = Math.max(0, Number(e.target.value) || 0); atualizar(); };
  $("nome").oninput = () => { renderPainel(); salvar(); };
  $("enviar").onclick = enviarPedido;

  atualizar();
}
iniciar();
