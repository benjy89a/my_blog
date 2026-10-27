// ===== 설정값 =====
const SHIELD_CHANCE = 1 / 6;   // 실드 주사위가 나올 확률
const AI_DELAY = 700;          // AI 행동 사이 쉬는 시간(ms)
const DESTROY_DELAY = 800;     // 파괴 효과를 보여주는 시간(ms)
const NAMES = { player: "나", ai: "AI" };

// ===== 게임 상태 =====
// 보드 = 가로줄 3개, 줄마다 칸 3개. 빈칸은 null, 주사위는 { value, shield, foreign }
// 칸 번호 0 = 가운데와 가장 가까운 "맨 앞" 칸. 주사위는 0번부터 차례로 쌓임 (중간에 빈칸 없음)
// foreign: 상대가 실드로 내 보드에 놓은 주사위인지
const state = {
  boards: null,
  turn: "player",
  die: null,
  rerolls: null,
  moveCount: null,
  busy: false,   // 애니메이션/AI 진행 중이면 true → 클릭 막기
  over: false,
  logs: [],
};

const DEBUG = new URLSearchParams(location.search).has("debug");

// ===== 작은 도우미 함수들 =====
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const other = (side) => (side === "player" ? "ai" : "player");
const emptyBoard = () => [[null, null, null], [null, null, null], [null, null, null]];
const isFull = (board) => board.every((row) => !row.includes(null));
// 양쪽 보드가 "둘 다" 꽉 차야 게임 끝
const isGameOver = (boards) => isFull(boards.player) && isFull(boards.ai);

function cloneBoards(b) {
  return { player: b.player.map((r) => r.slice()), ai: b.ai.map((r) => r.slice()) };
}

// 한 줄을 "바로 옆에 붙은 같은 숫자" 묶음으로 나누기
// 예: [1,1,2] → [{value:1,start:0,len:2}, {value:2,start:2,len:1}]
//     [1,3,1] → 1, 3, 1 각각 따로 (붙어있지 않으니 묶이지 않음)
function rowGroups(row) {
  const groups = [];
  let i = 0;
  while (i < 3) {
    if (!row[i]) { i++; continue; }
    let j = i;
    while (j + 1 < 3 && row[j + 1] && row[j + 1].value === row[i].value) j++;
    groups.push({ value: row[i].value, start: i, len: j - i + 1 });
    i = j + 1;
  }
  return groups;
}

// 줄 점수: 붙어있는 묶음마다 (숫자 합) × 개수
// 예: [1,1,2] → (1+1)×2 + 2 = 6,  [1,3,1] → 1+3+1 = 5,  [5,5,5] → 15×3 = 45
function rowScore(row) {
  return rowGroups(row).reduce((sum, g) => sum + g.value * g.len * g.len, 0);
}

const totalScore = (board) => board.reduce((sum, row) => sum + rowScore(row), 0);

// ===== 주사위 =====
function rollDie() {
  let value = Math.floor(Math.random() * 6) + 1;
  let shield = Math.random() < SHIELD_CHANCE;
  if (DEBUG) {
    const v = $("debug-value").value;
    const s = $("debug-shield").value;
    if (v) value = Number(v);
    if (s) shield = s === "shield";
  }
  return { value, shield };
}

// ===== 규칙 (보드를 직접 바꾸는 함수들) =====
// move = { target: 놓을 보드, row: 줄 번호 }  (칸은 고를 수 없고, 안쪽부터 자동으로 쌓임)

// 실드를 상대 보드의 r번 줄에 놓을 수 있는지
// 조건: 실드 + 내 첫 턴이 아님 + 그 줄이 완전히 비어 있음
function canInvade(boards, side, die, r) {
  return die.shield && state.moveCount[side] > 0 &&
    boards[other(side)][r].every((d) => !d);
}

// 놓을 수 있는 줄 목록. 내 보드의 빈칸 있는 줄 + (조건 맞으면) 상대 보드의 빈 줄
function legalMoves(boards, side, die) {
  const moves = [];
  boards[side].forEach((row, r) => {
    if (row.includes(null)) moves.push({ target: side, row: r });
  });
  boards[other(side)].forEach((row, r) => {
    if (canInvade(boards, side, die, r)) moves.push({ target: other(side), row: r });
  });
  return moves;
}

// 줄의 다음 빈칸(가장 안쪽 빈칸)에 놓고, 놓인 칸 번호를 돌려줌
function placeInto(boards, side, die, move) {
  const row = boards[move.target][move.row];
  const idx = row.indexOf(null);
  row[idx] = { value: die.value, shield: die.shield, foreign: move.target !== side };
  return idx;
}

// 상대 줄의 맨 앞(0번 칸) 주사위를 부술 수 있는지
// 조건: 내 보드에 놓았고, 상대 맨 앞 주사위가 같은 숫자이고, 실드가 아님
function canDestroy(boards, side, die, move) {
  if (move.target !== side) return false;
  const front = boards[other(side)][move.row][0];
  return !!front && !front.shield && front.value === die.value;
}

// 빈칸을 없애고 남은 주사위를 안쪽(0번 쪽)으로 당김
function compact(row) {
  const kept = row.filter(Boolean);
  while (kept.length < 3) kept.push(null);
  return kept;
}

// 파괴 처리: 상대 맨 앞 주사위 + 내가 놓은 주사위(실드가 아니면)를 함께 없애고 당기기
function applyDestroy(boards, side, die, move, idx) {
  const opp = other(side);
  boards[opp][move.row][0] = null;
  boards[opp][move.row] = compact(boards[opp][move.row]);
  if (!die.shield) {
    boards[side][move.row][idx] = null;
    boards[side][move.row] = compact(boards[side][move.row]);
  }
}

// 최종 판정
function judge(boards) {
  const rows = [0, 1, 2].map((r) => ({
    p: rowScore(boards.player[r]),
    a: rowScore(boards.ai[r]),
  }));
  const pWins = rows.filter((x) => x.p > x.a).length;
  const aWins = rows.filter((x) => x.a > x.p).length;
  const pTotal = totalScore(boards.player);
  const aTotal = totalScore(boards.ai);
  let winner, byTotal = false;
  if (pWins >= 2) winner = "player";
  else if (aWins >= 2) winner = "ai";
  else {
    byTotal = true;
    winner = pTotal > aTotal ? "player" : aTotal > pTotal ? "ai" : "draw";
  }
  return { rows, pWins, aWins, pTotal, aTotal, winner, byTotal };
}

// ===== AI =====

// 가상으로 한 수 둬 보기 (진짜 보드는 안 바뀜)
function simulate(boards, side, die, move) {
  const b = cloneBoards(boards);
  const idx = placeInto(b, side, die, move);
  if (canDestroy(b, side, die, move)) applyDestroy(b, side, die, move, idx);
  return b;
}

// 이 보드 상태가 me에게 얼마나 좋은지 점수 매기기
function evaluateFor(boards, me) {
  if (isGameOver(boards)) {
    const j = judge(boards);
    if (j.winner === me) return 1000;
    if (j.winner === "draw") return 0;
    return -1000;
  }
  const opp = other(me);
  let s = 0;
  for (let r = 0; r < 3; r++) {
    const mine = rowScore(boards[me][r]);
    const theirs = rowScore(boards[opp][r]);
    s += mine - theirs;
    if (mine > theirs) s += 8;      // 줄을 이기고 있으면 보너스
    else if (mine < theirs) s -= 8;
  }
  return s;
}

function bestMove(side, die) {
  let best = null;
  legalMoves(state.boards, side, die).forEach((move) => {
    const score = evaluateFor(simulate(state.boards, side, die, move), side) + Math.random() * 1.5;
    if (!best || score > best.score) best = { move, score };
  });
  return best;
}

async function aiTurn() {
  state.busy = true;
  render();
  await sleep(AI_DELAY);

  state.die = rollDie();
  addLog(`AI가 ${dieText(state.die)}을(를) 굴렸어요.`);
  render({ rolled: true });
  await sleep(AI_DELAY);

  let choice = bestMove("ai", state.die);
  const now = evaluateFor(state.boards, "ai");
  // 놓을 곳이 없거나, 별로인 주사위(낮은 일반 숫자 + 큰 이득 없음)면 리롤 사용
  const bad = !choice || (!state.die.shield && state.die.value <= 3 && choice.score - now < 4);
  if (state.rerolls.ai > 0 && bad) {
    state.rerolls.ai--;
    state.die = rollDie();
    addLog(`AI가 리롤! → ${dieText(state.die)}`);
    render({ rolled: true });
    await sleep(AI_DELAY);
    choice = bestMove("ai", state.die);
  }

  if (!choice) return passTurn("ai");
  await doMove("ai", choice.move);
}

// ===== 한 수 두기 (나와 AI 공통) =====
async function doMove(side, move) {
  state.busy = true;
  const die = state.die;
  const boards = state.boards;
  const opp = other(side);

  const destroy = canDestroy(boards, side, die, move);   // 놓기 전에 상대 맨 앞을 확인
  const idx = placeInto(boards, side, die, move);
  state.moveCount[side]++;
  const where = move.target === side ? "" : `${NAMES[move.target]} 보드의 `;
  addLog(`${NAMES[side]}: ${dieText(die)} → ${where}${move.row + 1}번 줄`);
  const placed = { side: move.target, row: move.row, idx };
  render({ placed });

  if (destroy) {
    await sleep(350);
    const destroying = [{ side: opp, row: move.row, idx: 0 }];
    if (!die.shield) destroying.push(placed);   // 내 주사위도 같이 깨짐
    render({ destroying });
    const hitSides = die.shield ? [opp] : [opp, side];
    hitSides.forEach((s) => $("side-" + s).classList.add("hit"));
    addLog(
      `💥 파괴! ${NAMES[opp]}의 ${move.row + 1}번 줄 맨 앞 [${die.value}]` +
        (die.shield ? " (실드는 남음)" : ` + ${NAMES[side]}의 주사위도 함께`),
      "boom"
    );
    await sleep(DESTROY_DELAY);
    hitSides.forEach((s) => $("side-" + s).classList.remove("hit"));
    applyDestroy(boards, side, die, move, idx);
  }

  state.die = null;

  if (isGameOver(boards)) {
    state.over = true;
    state.busy = false;
    addLog("양쪽 보드가 모두 꽉 찼어요. 게임 종료!");
    render();
    await sleep(500);
    showResult();
    return;
  }

  endTurn(side);
}

// 턴 넘기기 (보드가 꽉 찬 사람도 턴은 받아서 굴려봄 → 실드면 공격 기회)
function endTurn(side) {
  state.die = null;
  state.turn = other(side);
  state.busy = false;
  render();
  if (state.turn === "ai") aiTurn();
}

// 놓을 곳이 없는 주사위 → 그냥 턴을 넘김
async function passTurn(side) {
  state.busy = true;
  addLog(`${NAMES[side]}: 놓을 곳이 없어서 턴을 넘겨요.`);
  render();
  await sleep(AI_DELAY);
  endTurn(side);
}

const hasMoves = (side) => legalMoves(state.boards, side, state.die).length > 0;

// ===== 내 조작 =====
function canPlayerAct() {
  return state.turn === "player" && !state.busy && !state.over;
}

function canPlace(side, r) {
  if (!canPlayerAct() || !state.die) return false;
  if (side === "ai") return canInvade(state.boards, "player", state.die, r);
  return state.boards[side][r].includes(null);
}

// 놓을 곳 없는 주사위면: 리롤이 남았으면 고를 기회를 주고, 없으면 자동으로 턴 넘김
function checkStuck() {
  if (!hasMoves("player") && state.rerolls.player <= 0) passTurn("player");
}

function onRoll() {
  if (!canPlayerAct()) return;
  if (state.die) {   // 놓을 곳이 없을 때는 이 버튼이 "턴 넘기기"
    if (!hasMoves("player")) passTurn("player");
    return;
  }
  state.die = rollDie();
  addLog(`내가 ${dieText(state.die)}을(를) 굴렸어요.`);
  render({ rolled: true });
  checkStuck();
}

function onReroll() {
  if (!canPlayerAct() || !state.die || state.rerolls.player <= 0) return;
  state.rerolls.player--;
  state.die = rollDie();
  addLog(`리롤! → ${dieText(state.die)}`);
  render({ rolled: true });
  checkStuck();
}

function onRowClick(side, r) {
  if (!canPlace(side, r)) return;
  doMove("player", { target: side, row: r });
}

// ===== 화면 그리기 =====
function dieText(die) {
  return die.shield ? `🛡실드 ${die.value}` : `${die.value}`;
}

function sameCell(a, side, r, i) {
  return a && a.side === side && a.row === r && a.idx === i;
}

function renderBoard(side, fx) {
  const boardEl = $("board-" + side);
  boardEl.innerHTML = "";

  state.boards[side].forEach((row, r) => {
    const rowEl = document.createElement("div");
    rowEl.className = "row";   // 내 보드는 CSS에서 좌우를 뒤집어 0번 칸이 가운데 쪽에 오게 함

    // 칸마다 "붙어있는 묶음 크기" 알아두기 (색칠용)
    const groups = rowGroups(row);
    const groupLen = [1, 1, 1];
    groups.forEach((g) => { for (let k = 0; k < g.len; k++) groupLen[g.start + k] = g.len; });
    const maxLen = Math.max(0, ...groups.map((g) => g.len));

    // 지금 내 주사위로 부술 수 있는 AI 맨 앞 주사위 표시용
    const front = row[0];
    const targetable = side === "ai" && canPlace("player", r) && front && !front.shield &&
      front.value === state.die.value;

    row.forEach((d, i) => {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (d) {
        cell.classList.add("filled");
        if (groupLen[i] === 2) cell.classList.add("syn2");
        if (groupLen[i] === 3) cell.classList.add("syn3");
        if (d.shield) cell.classList.add("shield");
        if (d.foreign) cell.classList.add("foreign");
        cell.innerHTML = `<span>${d.value}</span>` + (d.shield ? `<span class="badge">🛡</span>` : "");
        if (i === 0 && targetable) {
          cell.classList.add("target");
          // 💥 주사위를 누르면 = 내 같은 번호 줄에 놓아서 부수기
          cell.addEventListener("click", (e) => {
            e.stopPropagation();   // 실드일 때 AI 줄에 놓이는 클릭과 겹치지 않게
            onRowClick("player", r);
          });
        }
      } else if (i === row.indexOf(null) && canPlace(side, r)) {
        cell.classList.add("next");   // 다음에 쌓일 칸
      }
      if (sameCell(fx.placed, side, r, i)) cell.classList.add("placed");
      if (fx.destroying && fx.destroying.some((x) => sameCell(x, side, r, i))) cell.classList.add("destroying");
      rowEl.appendChild(cell);
    });

    // 줄 바깥쪽에 점수 (+ 시너지 배수)
    const scoreEl = document.createElement("div");
    scoreEl.className = "row-score";
    scoreEl.innerHTML =
      `<small>${r + 1}번 줄</small>${rowScore(row)}` +
      (maxLen >= 2 ? `<span class="mult">×${maxLen}</span>` : "");
    rowEl.appendChild(scoreEl);

    if (canPlace(side, r)) {
      rowEl.classList.add("droppable");
      if (side === "ai") rowEl.classList.add("shield-target");
      rowEl.addEventListener("click", () => onRowClick(side, r));
    }
    boardEl.appendChild(rowEl);
  });

  $("total-" + side).textContent = totalScore(state.boards[side]);
}

function render(fx = {}) {
  renderBoard("player", fx);
  renderBoard("ai", fx);

  // 누구 턴인지
  const turnEl = $("turn");
  turnEl.className = "turn";
  if (state.over) { turnEl.classList.add("turn-over"); turnEl.textContent = "🏁 게임 종료"; }
  else if (state.turn === "player") { turnEl.classList.add("turn-player"); turnEl.textContent = "🙂 내 턴"; }
  else { turnEl.classList.add("turn-ai"); turnEl.textContent = "🤖 AI 턴"; }

  $("side-player").classList.toggle("active", !state.over && state.turn === "player");
  $("side-ai").classList.toggle("active", !state.over && state.turn === "ai");

  // 주사위 표시
  const dieEl = $("die");
  const typeEl = $("die-type");
  dieEl.className = "die";
  typeEl.className = "die-type";
  if (state.die) {
    const kind = state.die.shield ? "shield" : "normal";
    dieEl.classList.add(kind);
    if (fx.rolled) dieEl.classList.add("rolled");
    dieEl.textContent = state.die.value;
    typeEl.classList.add(kind);
    typeEl.textContent = state.die.shield ? "🛡 실드 주사위" : "일반 주사위";
  } else {
    dieEl.textContent = "?";
    typeEl.textContent = "아직 굴리지 않음";
  }

  // 버튼
  const stuck = state.turn === "player" && state.die && !hasMoves("player");
  $("btn-roll").disabled = !canPlayerAct() || (!!state.die && !stuck);
  $("btn-roll").textContent = stuck ? "⏭ 턴 넘기기" : "🎲 주사위 굴리기";
  $("btn-reroll").disabled = !canPlayerAct() || !state.die || state.rerolls.player <= 0;
  $("reroll-left").textContent = state.rerolls.player;
  $("ai-reroll").textContent = `(리롤 ${state.rerolls.ai}회)`;

  // 안내 문구
  let hint;
  if (state.over) hint = "게임이 끝났어요.";
  else if (state.turn === "ai") hint = "🤖 AI가 생각 중...";
  else if (!state.die && isFull(state.boards.player)) hint = "내 보드가 꽉 찼어요. 굴려서 🛡실드가 나오면 AI의 텅 빈 줄을 공격할 수 있어요!";
  else if (!state.die) hint = "🎲 주사위를 굴려주세요!";
  else if (stuck) hint = "놓을 곳이 없어요. 리롤하거나 턴을 넘기세요.";
  else if (state.die.shield) {
    const canGo = [0, 1, 2].some((r) => canInvade(state.boards, "player", state.die, r));
    if (canGo) hint = "🛡 실드! 내 줄 또는 AI의 텅 빈 줄(노란 점선)을 누르세요.";
    else if (state.moveCount.player === 0) hint = "🛡 실드지만 첫 턴이라 AI 보드에는 못 놓아요. 내 줄을 누르세요.";
    else hint = "🛡 실드지만 AI에 텅 빈 줄이 없어요. 내 줄을 누르세요.";
  }
  else hint = "내 보드에서 놓을 줄(파란 점선)을 누르세요. 💥 AI 주사위를 누르면 바로 부숴요!";
  $("hint").textContent = hint;

  renderLog();
}

function addLog(text, cls = "") {
  state.logs.unshift({ text, cls });
  state.logs = state.logs.slice(0, 30);
  renderLog();
}

function renderLog() {
  $("log").innerHTML = state.logs
    .map((l) => `<li class="${l.cls}">${l.text}</li>`)
    .join("");
}

// ===== 결과 모달 =====
function showResult() {
  const j = judge(state.boards);
  const titles = { player: "🎉 승리!", ai: "😢 패배...", draw: "🤝 무승부" };
  $("result-title").textContent = titles[j.winner];

  let rows = `<tr><th></th><th>나</th><th>AI</th></tr>`;
  j.rows.forEach((x, r) => {
    rows += `<tr><td>${r + 1}번 줄</td>
      <td class="${x.p > x.a ? "win" : ""}">${x.p}</td>
      <td class="${x.a > x.p ? "win" : ""}">${x.a}</td></tr>`;
  });
  rows += `<tr><td>총점</td><td>${j.pTotal}</td><td>${j.aTotal}</td></tr>`;
  $("result-table").innerHTML = rows;

  $("result-reason").textContent = j.byTotal
    ? `이긴 줄 수가 같아서(나 ${j.pWins} : AI ${j.aWins}) 총점으로 판정했어요.`
    : `${j.winner === "player" ? "내가" : "AI가"} 3줄 중 ${Math.max(j.pWins, j.aWins)}줄을 이겼어요.`;

  $("modal").classList.remove("hidden");
}

// ===== 시작 =====
function newGame() {
  state.boards = { player: emptyBoard(), ai: emptyBoard() };
  state.turn = "player";
  state.die = null;
  state.rerolls = { player: 1, ai: 1 };
  state.moveCount = { player: 0, ai: 0 };   // 각자 몇 번 뒀는지 (첫 턴 확인용)
  state.busy = false;
  state.over = false;
  state.logs = [];
  $("modal").classList.add("hidden");
  addLog("게임 시작! 내가 먼저 합니다.");
  render();
}

$("btn-roll").addEventListener("click", onRoll);
$("btn-reroll").addEventListener("click", onReroll);
$("btn-restart").addEventListener("click", newGame);
if (DEBUG) $("debug").classList.remove("hidden");

newGame();
