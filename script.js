
// ----- Element references -----
const board_element = document.getElementById('game-board');
const cells = Array.from(document.querySelectorAll('.cell'));
const game_message = document.getElementById('game-message');
const restart_button = document.getElementById('restart-button');
const undo_button = document.getElementById('undo-button');
const reset_match_button = document.getElementById('reset-match-button');
const x_score_element = document.getElementById('x-score');
const o_score_element = document.getElementById('o-score');
const draw_score_element = document.getElementById('draw-score');
const x_score_label = document.getElementById('x-score-label');
const o_score_label = document.getElementById('o-score-label');
const sound_toggle = document.getElementById('sound-toggle');
const theme_toggle = document.getElementById('theme-toggle');
const mode_buttons = Array.from(document.querySelectorAll('[data-mode]'));
const difficulty_group = document.getElementById('difficulty-group');
const difficulty_buttons = Array.from(document.querySelectorAll('[data-difficulty]'));
const result_dialog = document.getElementById('result-dialog');
const result_title = document.getElementById('result-title');
const result_text = document.getElementById('result-text');
const dialog_close_button = document.getElementById('dialog-close-button');
const dialog_play_again_button = document.getElementById('dialog-play-again-button');
const game_mode_dialog = document.getElementById('game-mode-dialog');
const start_mode_buttons = Array.from(document.querySelectorAll('[data-start-mode]'));
const player_name_dialog = document.getElementById('player-name-dialog');
const player_name_form = document.getElementById('player-name-form');
const player_x_name_input = document.getElementById('player-x-name');
const player_o_name_input = document.getElementById('player-o-name');
const x_leaderboard_name = document.getElementById('x-leaderboard-name');
const o_leaderboard_name = document.getElementById('o-leaderboard-name');
const x_leaderboard_wins = document.getElementById('x-leaderboard-wins');
const o_leaderboard_wins = document.getElementById('o-leaderboard-wins');
const x_coins_element = document.getElementById('x-coins');
const o_coins_element = document.getElementById('o-coins');
const leaderboard = document.getElementById('leaderboard');
const x_leaderboard_entry = document.getElementById('x-leaderboard-entry');
const o_leaderboard_entry = document.getElementById('o-leaderboard-entry');
 
// Each group contains the three board positions that make a winning line.
const winning_combinations = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6]              // Diagonals
];
 
// ----- Game state -----
let board = Array(9).fill('');
let current_player = 'X';
let game_is_active = true;
let winning_line = [];
let move_history = []; // snapshots taken before each move, for undo
let is_cpu_thinking = false;
let focused_index = 0;
 
let mode = 'pvp';       // 'pvp' or 'cpu'
let difficulty = 'hard'; // 'easy' or 'hard'
let sound_on = true;
let player_names = { X: '', O: '' };
 
const scores = { X: 0, O: 0, draws: 0 };
const coins = { X: 0, O: 0 };
const leaderboard_wins = { X: 0, O: 0 };
const leaderboard_storage_key = 'tic-tac-toe-leaderboard-v1';
 
let audio_context = null;

// Keep player names and leaderboard progress after the browser is refreshed.
function load_leaderboard() {
  try {
    const saved_data = JSON.parse(localStorage.getItem(leaderboard_storage_key));
    if (!saved_data) return;

    player_names.X = typeof saved_data.player_names?.X === 'string' ? saved_data.player_names.X : '';
    player_names.O = typeof saved_data.player_names?.O === 'string' ? saved_data.player_names.O : '';
    leaderboard_wins.X = Number(saved_data.leaderboard_wins?.X) || 0;
    leaderboard_wins.O = Number(saved_data.leaderboard_wins?.O) || 0;
    coins.X = Number(saved_data.coins?.X) || 0;
    coins.O = Number(saved_data.coins?.O) || 0;
  } catch (error) {
    // A damaged saved record should not stop the game from loading.
    console.warn('Could not load the saved leaderboard.', error);
  }
}

function save_leaderboard() {
  const leaderboard_data = { player_names, leaderboard_wins, coins };

  try {
    localStorage.setItem(leaderboard_storage_key, JSON.stringify(leaderboard_data));
  } catch (error) {
    console.warn('Could not save the leaderboard.', error);
  }
}
 
// ----- Sound -----
function ensure_audio_context() {
  if (!audio_context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audio_context = new AudioContextClass();
    }
  }
  return audio_context;
}
 
function play_tone(frequency, duration_seconds) {
  if (!sound_on) return;
  const context = ensure_audio_context();
  if (!context) return;
 
  const oscillator = context.createOscillator();
  const gain_node = context.createGain();
 
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain_node.gain.setValueAtTime(0.08, context.currentTime);
  gain_node.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration_seconds);
 
  oscillator.connect(gain_node);
  gain_node.connect(context.destination);
 
  oscillator.start();
  oscillator.stop(context.currentTime + duration_seconds);
}
 
function play_move_sound(player) {
  play_tone(player === 'X' ? 440 : 330, 0.12);
}
 
function play_win_sound() {
  play_tone(523, 0.15);
  setTimeout(() => play_tone(659, 0.15), 130);
  setTimeout(() => play_tone(784, 0.22), 260);
}
 
function play_draw_sound() {
  play_tone(220, 0.25);
}
 
// ----- Rendering -----
function render_board() {
  cells.forEach((cell, index) => {
    const value = board[index];
    cell.textContent = value;
    cell.classList.remove('x', 'o', 'winner');
    if (value) cell.classList.add(value.toLowerCase());
    if (winning_line.includes(index)) cell.classList.add('winner');
    cell.disabled = Boolean(value) || !game_is_active;
 
    const row = Math.floor(index / 3) + 1;
    const column = (index % 3) + 1;
    cell.setAttribute('aria-label', value
      ? `Row ${row}, column ${column}, ${value}`
      : `Row ${row}, column ${column}, empty`);
  });
}
 
function update_message() {
  if (!game_is_active) return;
  game_message.textContent = `${get_player_label(current_player)}'s turn`;
}
 
function update_scoreboard() {
  x_score_element.textContent = scores.X;
  o_score_element.textContent = scores.O;
  draw_score_element.textContent = scores.draws;
  x_score_label.textContent = get_player_label('X');
  o_score_label.textContent = get_player_label('O');
  update_leaderboard();
}

// Return the name that should be shown for the current game mode.
function get_player_label(player) {
  if (mode === 'cpu' && player === 'O') return 'Computer';
  if (mode === 'cpu' && player === 'X' && !player_names.X) return 'You';
  return player_names[player];
}

// The leaderboard is a session summary: wins and 50-coin rewards.
function update_leaderboard() {
  x_leaderboard_name.textContent = get_player_label('X');
  o_leaderboard_name.textContent = get_player_label('O');
  x_leaderboard_wins.textContent = leaderboard_wins.X;
  o_leaderboard_wins.textContent = leaderboard_wins.O;
  x_coins_element.textContent = coins.X;
  o_coins_element.textContent = coins.O;

  // Put the player with the most wins first. Ties keep Player X first.
  const ranked_players = [
    { player: 'X', entry: x_leaderboard_entry },
    { player: 'O', entry: o_leaderboard_entry }
  ].sort((first, second) => leaderboard_wins[second.player] - leaderboard_wins[first.player]);

  ranked_players.forEach((ranked_player, index) => {
    ranked_player.entry.querySelector('.leaderboard-rank').textContent = `0${index + 1}`;
    leaderboard.appendChild(ranked_player.entry);
  });
}
 
function update_undo_button() {
  undo_button.disabled = move_history.length === 0 || is_cpu_thinking;
}

// Show a native dialog when the round has a winner or ends in a draw.
function show_result_dialog(title, message) {
  result_title.textContent = title;
  result_text.textContent = message;

  if (!result_dialog.open) {
    result_dialog.showModal();
  }
}
 
// ----- Game flow -----
function find_winner(current_board) {
  for (const combination of winning_combinations) {
    const [first, second, third] = combination;
    const player = current_board[first];
    if (player && player === current_board[second] && player === current_board[third]) {
      return { player, line: combination };
    }
  }
  return null;
}
 
function save_snapshot() {
  move_history.push({ board: board.slice(), current_player });
}
 
function apply_move(index, player) {
  save_snapshot();
  board[index] = player;
  play_move_sound(player);
  evaluate_after_move();
}
 
function evaluate_after_move() {
  const result = find_winner(board);
 
  if (result) {
    game_is_active = false;
    winning_line = result.line;
    scores[result.player] += 1;
    leaderboard_wins[result.player] += 1;
    const winner_label = get_player_label(result.player);
    game_message.textContent = `${winner_label} wins!`;
    // Human winners receive 50 coins. The computer never earns coins.
    if (mode === 'pvp' || result.player === 'X') {
      coins[result.player] += 50;
    }
    save_leaderboard();
    show_result_dialog(`${winner_label} wins!`, 'Great move. Ready for another round?');
    play_win_sound();
    update_scoreboard();
    render_board();
    update_undo_button();
    return;
  }
 
  if (!board.includes('')) {
    game_is_active = false;
    scores.draws += 1;
    game_message.textContent = "It's a draw!";
    show_result_dialog("It's a draw!", 'No more open squares. Try another round!');
    play_draw_sound();
    update_scoreboard();
    render_board();
    update_undo_button();
    return;
  }
 
  current_player = current_player === 'X' ? 'O' : 'X';
  render_board();
  update_message();
  update_undo_button();
 
  if (mode === 'cpu' && current_player === 'O' && game_is_active) {
    take_cpu_turn();
  }
}
 
function handle_cell_activation(index) {
  if (board[index] !== '' || !game_is_active || is_cpu_thinking) return;
  if (mode === 'cpu' && current_player === 'O') return;
  apply_move(index, current_player);
}
 
// ----- Computer opponent -----
function take_cpu_turn() {
  is_cpu_thinking = true;
  update_undo_button();
 
  setTimeout(() => {
    const index = difficulty === 'hard' ? pick_best_move(board, 'O') : pick_random_move(board);
    is_cpu_thinking = false;
    if (index !== null && game_is_active) {
      apply_move(index, 'O');
    }
  }, 420);
}
 
function pick_random_move(current_board) {
  const open_indexes = current_board
    .map((value, index) => (value === '' ? index : null))
    .filter((index) => index !== null);
  if (open_indexes.length === 0) return null;
  return open_indexes[Math.floor(Math.random() * open_indexes.length)];
}
 
// Unbeatable computer opponent using minimax with alpha-beta pruning.
function pick_best_move(current_board, computer_player) {
  const human_player = computer_player === 'O' ? 'X' : 'O';
  let best_score = -Infinity;
  let best_index = null;
 
  for (let index = 0; index < 9; index += 1) {
    if (current_board[index] !== '') continue;
    current_board[index] = computer_player;
    const score = minimax(current_board, 0, false, computer_player, human_player, -Infinity, Infinity);
    current_board[index] = '';
    if (score > best_score) {
      best_score = score;
      best_index = index;
    }
  }
 
  return best_index;
}
 
function minimax(current_board, depth, is_maximizing, computer_player, human_player, alpha, beta) {
  const result = find_winner(current_board);
  if (result) {
    return result.player === computer_player ? 10 - depth : depth - 10;
  }
  if (!current_board.includes('')) {
    return 0;
  }
 
  if (is_maximizing) {
    let best_score = -Infinity;
    for (let index = 0; index < 9; index += 1) {
      if (current_board[index] !== '') continue;
      current_board[index] = computer_player;
      best_score = Math.max(best_score, minimax(current_board, depth + 1, false, computer_player, human_player, alpha, beta));
      current_board[index] = '';
      alpha = Math.max(alpha, best_score);
      if (beta <= alpha) break;
    }
    return best_score;
  }
 
  let best_score = Infinity;
  for (let index = 0; index < 9; index += 1) {
    if (current_board[index] !== '') continue;
    current_board[index] = human_player;
    best_score = Math.min(best_score, minimax(current_board, depth + 1, true, computer_player, human_player, alpha, beta));
    current_board[index] = '';
    beta = Math.min(beta, best_score);
    if (beta <= alpha) break;
  }
  return best_score;
}
 
// ----- Undo -----
function undo_last_turn() {
  if (move_history.length === 0 || is_cpu_thinking) return;
 
  game_is_active = true;
  winning_line = [];
 
  let snapshot = move_history.pop();
 
  // In computer mode, one on-screen "turn" is really two moves (human then
  // computer). Step back through both so the human always lands on their turn.
  if (mode === 'cpu' && snapshot.current_player === 'O' && move_history.length > 0) {
    snapshot = move_history.pop();
  }
 
  board = snapshot.board;
  current_player = snapshot.current_player;
 
  render_board();
  update_message();
  update_undo_button();
}
 
// ----- Restart / reset -----
function start_new_round() {
  if (result_dialog.open) {
    result_dialog.close();
  }

  board = Array(9).fill('');
  current_player = 'X';
  game_is_active = true;
  winning_line = [];
  move_history = [];
  is_cpu_thinking = false;
 
  render_board();
  update_message();
  update_undo_button();
}
 
function reset_match_score() {
  scores.X = 0;
  scores.O = 0;
  scores.draws = 0;
  update_scoreboard();
  start_new_round();
}
 
// ----- Mode / difficulty / preference controls -----
function set_mode(next_mode) {
  mode = next_mode;
  mode_buttons.forEach((button) => {
    const is_active = button.dataset.mode === mode;
    button.classList.toggle('is-active', is_active);
    button.setAttribute('aria-checked', String(is_active));
  });
  update_difficulty_visibility();
  update_scoreboard();
  start_new_round();

  if (mode === 'pvp') {
    show_player_name_dialog();
  }
}

// Difficulty is only useful when the computer is the opponent.
function update_difficulty_visibility() {
  const is_computer_mode = mode === 'cpu';
  difficulty_group.hidden = !is_computer_mode;
  difficulty_group.style.display = is_computer_mode ? 'flex' : 'none';
}
 
function set_difficulty(next_difficulty) {
  difficulty = next_difficulty;
  difficulty_buttons.forEach((button) => {
    const is_active = button.dataset.difficulty === difficulty;
    button.classList.toggle('is-active', is_active);
    button.setAttribute('aria-checked', String(is_active));
  });
}

// Ask for player names whenever a two-player game is started.
function show_player_name_dialog() {
  player_x_name_input.value = player_names.X;
  player_o_name_input.value = player_names.O;

  if (!player_name_dialog.open) {
    player_name_dialog.showModal();
  }
}

// The first dialog asks how the visitor wants to play.
function show_game_mode_dialog() {
  if (!game_mode_dialog.open) {
    game_mode_dialog.showModal();
  }
}

function save_player_names(event) {
  event.preventDefault();
  const x_name = player_x_name_input.value.trim();
  const o_name = player_o_name_input.value.trim();

  // The dialog asks for real names, so do not save blank values.
  if (!x_name || !o_name) return;

  player_names.X = x_name;
  player_names.O = o_name;
  save_leaderboard();
  player_name_dialog.close();
  update_scoreboard();
  update_message();
}
 
// ----- Keyboard navigation (roving tabindex across the grid) -----
function move_focus(next_index) {
  cells[focused_index].tabIndex = -1;
  focused_index = (next_index + 9) % 9;
  cells[focused_index].tabIndex = 0;
  cells[focused_index].focus();
}
 
function handle_board_keydown(event) {
  const key_to_delta = {
    ArrowRight: 1,
    ArrowLeft: -1,
    ArrowDown: 3,
    ArrowUp: -3,
  };
 
  if (key_to_delta[event.key] !== undefined) {
    event.preventDefault();
    move_focus(focused_index + key_to_delta[event.key]);
    return;
  }
 
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handle_cell_activation(focused_index);
  }
}
 
// ----- Event wiring -----
cells.forEach((cell) => {
  cell.addEventListener('click', () => handle_cell_activation(Number(cell.dataset.index)));
  cell.addEventListener('focus', () => {
    focused_index = Number(cell.dataset.index);
  });
});
 
board_element.addEventListener('keydown', handle_board_keydown);
restart_button.addEventListener('click', start_new_round);
undo_button.addEventListener('click', undo_last_turn);
reset_match_button.addEventListener('click', reset_match_score);
dialog_close_button.addEventListener('click', () => result_dialog.close());
dialog_play_again_button.addEventListener('click', start_new_round);
player_name_form.addEventListener('submit', save_player_names);
player_name_dialog.addEventListener('cancel', (event) => event.preventDefault());
game_mode_dialog.addEventListener('cancel', (event) => event.preventDefault());

start_mode_buttons.forEach((button) => {
  button.addEventListener('click', () => {
    game_mode_dialog.close();
    set_mode(button.dataset.startMode);
  });
});
 
mode_buttons.forEach((button) => {
  button.addEventListener('click', () => set_mode(button.dataset.mode));
});
 
difficulty_buttons.forEach((button) => {
  button.addEventListener('click', () => set_difficulty(button.dataset.difficulty));
});
 
sound_toggle.addEventListener('change', () => {
  sound_on = sound_toggle.checked;
});
 
theme_toggle.addEventListener('change', () => {
  document.body.dataset.theme = theme_toggle.checked ? 'light' : 'dark';
});
 
// ----- Initial paint -----
load_leaderboard();
update_difficulty_visibility();
update_scoreboard();
update_message();
update_undo_button();
show_game_mode_dialog();
 
