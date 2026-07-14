/**
 * Internationalization: a flat message dictionary keyed by language, plus a
 * translator factory. This is the ONE place UI copy lives — the renderers in
 * render.js / ui/*.js hold no literal strings, they call t(key, params).
 *
 * A message value is either a plain string or a function (params) => string.
 * The function form is what makes this extensible without touching call sites:
 * per-language grammar (pluralization, conjugation, word order) is expressed
 * IN the dictionary, so adding a language is a data change, never a code change.
 *
 * Adding a language: add its code to LANGUAGES and a block to `messages`.
 * Missing keys fall back to English, so a partial translation still renders.
 *
 * Like the fantasy-suit theme, this stays a pure presentation concern: the
 * shared rules engine and the game model never know which language is active.
 */

export const DEFAULT_LANG = "en";

/** Cycle order for the toggle; `label` is the compact HUD/menu chip. */
export const LANGUAGES = [
    { code: "pt", label: "PT", name: "Português" },
    { code: "en", label: "EN", name: "English" },
];

/** The language after `code` in LANGUAGES, wrapping around. Drives the toggle. */
export function nextLanguage(code) {
    const i = LANGUAGES.findIndex((l) => l.code === code);
    return LANGUAGES[(i + 1) % LANGUAGES.length].code;
}

export function languageMeta(code) {
    return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

/** Exported for the completeness test in test/i18n.test.js. */
export const messages = {
    en: {
        // --- menu & lobby ---
        "menu.tagline": "Push your opponent off the board.",
        "menu.createRoom": "Create room",
        "menu.createHint": "You'll get a short code to share with your opponent.",
        "menu.or": "or",
        "menu.roomCodePlaceholder": "Room code",
        "menu.joinRoom": "Join",
        "menu.newHotseat": "New hotseat game",
        "menu.hotseatHint": "Two players, one device — debugging mode.",
        "lobby.roomCode": "Room code",
        "lobby.shareHint": "Share this code — the game starts when your opponent joins.",
        "lobby.copyLink": "Copy invite link",
        "lobby.linkCopied": "Link copied!",
        "lobby.waiting": "Waiting for your opponent to join…",
        "lobby.connecting": "Connecting to the server…",
        "common.cancel": "Cancel",
        "common.close": "Close",
        "common.backToMenu": "Back to menu",

        // --- curtain (hotseat) ---
        "curtain.lastRound": "Last round",
        "curtain.pass": ({ n }) => `Pass the device to Player ${n}`,
        "curtain.continue": ({ n }) => `I'm Player ${n} — continue`,

        // --- player names ---
        "player.you": "You",
        "player.opponent": "Opponent",
        "player.n": ({ n }) => `Player ${n}`,

        // --- connection banners ---
        "banner.connectionLost": "Connection lost — reconnecting…",
        "banner.opponentDisconnected": "Your opponent disconnected — waiting for them to return…",

        // --- sidebar ---
        "side.lastRound": "Last round",
        "side.roundLog": "Round history",

        // --- round-history log ---
        "log.tie": "Tie",
        "log.youWon": "You won",
        "log.wonBy": ({ label }) => `${label} won`,

        // --- swap window ---
        "swap.closed": "Swap window closed — waiting for your opponent…",
        "swap.instructions": ({ seat, remaining }) => `${seat}: select cards to swap, or keep the hand you hold.`,
        "swap.selected": ({ n }) => `Swap selected (${n})`,
        "swap.done": "Done — keep hand",

        // --- pick phase ---
        "pick.committed": "Card committed — waiting for your opponent…",
        "pick.dangerTitle": "Danger zone!",
        "pick.openWaiting": "Your opponent must play openly first — waiting for their card…",
        "pick.openRevealed": "Your opponent had to play openly:",
        "pick.opponentInDangerTitle": "Your opponent is in danger.",
        "pick.opponentInDangerBody": "You must play openly — they will see your card before picking theirs.",
        "pick.instructions": ({ seat }) => `${seat}: choose a card to play. It stays secret until both are committed.`,
        "pick.play": "Play selected card",

        // --- winner move ---
        "move.waiting": "Waiting for the round winner…",
        "move.push": "Push opponent (K):",
        "move.advance": ({ n }) => `Advance ${n}`,
        "move.retreat": ({ n }) => `Retreat ${n}`,
        "move.stay": "Stay",
        "move.introYou": ({ range }) => `You won the round — choose your move (up to ${range} either way).`,
        "move.introSeat": ({ n, range }) => `Player ${n}, you won the round — choose your move (up to ${range} either way).`,
        "move.confirm": "Confirm move",

        // --- game over ---
        "over.draw": "Both players were pushed out — the game is a draw!",
        "over.onlineConcededWin": "Your opponent conceded — you win the game!",
        "over.onlineConcededLose": "You conceded — your opponent wins the game.",
        "over.onlineWin": "You win the game!",
        "over.onlineLose": "You lose — your opponent wins the game.",
        "over.hotseatConceded": ({ conceder, winner }) => `Player ${conceder} conceded — Player ${winner} wins the game!`,
        "over.hotseatWin": ({ winner }) => `Player ${winner} wins the game!`,
        "over.rematch": "Rematch",
        "over.rematchWaiting": "Waiting for opponent…",
        "over.rematchAsked": "Rematch requested — waiting for your opponent.",
        "over.opponentWantsRematch": "Your opponent wants a rematch!",

        // --- HUD ---
        "phase.SWAP_WINDOW": "Swap window",
        "phase.PICK_CARDS": "Pick cards",
        "phase.WINNER_MOVE": "Winner moves",
        "phase.GAME_OVER": "Game over",
        "hud.round": ({ n }) => `Round ${n}`,
        "hud.youAre": ({ n }) => `You are Player ${n}`,
        "hud.classicSuits": "Classic suits",
        "hud.fantasySuits": "Fantasy suits",
        "hud.suitsTitle": "Switch between classic suits and fantasy weapons",
        "hud.soundOn": "Sound on — click to mute",
        "hud.soundOff": "Sound off — click to unmute",
        "concede.confirm": "Concede the game?",
        "concede.yes": "Yes, concede",
        "concede.keepPlaying": "Keep playing",
        "concede.button": "Concede",

        // --- suit-cycle reference ---
        "cycle.title": "Suit order",
        "cycle.note": "Each suit beats the next — breaks ties and rules A duels",

        // --- reveal panel ---
        "reveal.manilhaPlayed": "Manilha played — worth 14",
        "reveal.kRemoved": "K removed the distance modifiers",
        "reveal.suitOrder": "Decided by suit order",
        "reveal.jInverted": "J inverted the result!",
        "reveal.tie": "Tie — both pawns retreat 1",
        "reveal.youWin": "You win the round",
        "reveal.winsRound": ({ label }) => `${label} wins the round`,
        "reveal.manilhaWord": "Manilha",
        "reveal.dist": "dist",
        // loserEffect wording — `you` is true when the loser is the local player.
        "effect.retreat": ({ loser, you, n }) => `${loser} ${you ? "retreat" : "retreats"} ${n}`,
        "effect.returnToFirst": ({ loser, you }) => `${loser} ${you ? "return to your" : "returns to their"} first space (lost with K)`,
        "effect.kPush": ({ winner, loser, you }) => `${winner} may push ${you ? "you" : loser} up to 3 spaces`,

        // --- board buff bar ---
        "buff.distance": "Distance",
        "buff.sword": "Sword",
        "buff.bow": "Bow",
        "buff.magic": "Magic",

        // --- opponent row & hand ---
        "chip.swapsLeft": ({ n }) => `Swaps left ${n}`,
        "chip.committed": "Card committed",
        "hand.yours": "Your hand",
        "hand.playerN": ({ n }) => `Player ${n}'s hand`,
        "hand.youPlayed": "You played",

        // --- piles & manilha ---
        "piles.deck": "Deck",
        "piles.graveyard": "Graveyard",
        "manilha.title": "Manilha",
        "manilha.beforeReveal": "Revealed after the swap window",
        "manilha.faceCard": "Face card — no manilha this round",
        "manilha.everyRank": ({ rank }) => `Every <b>${rank}</b> is worth 14`,

        // --- graveyard modal ---
        "grave.title": ({ n }) => `Graveyard (${n})`,
        "grave.empty": "Empty — no cards discarded yet.",

        // --- language toggle & help ---
        "lang.title": ({ name }) => `Language: ${name} — click to switch`,
        "help.button": "Rules",
        "help.title": "How to play",

        // --- rules modal (structured sections) ---
        "rules.sections": [
            {
                h: "Objective",
                p: ["Push your opponent off their end of the 12-space board. A player is eliminated the moment they are pushed beyond their own first space — their <b>danger zone</b>."],
            },
            {
                h: "The board & distance",
                p: ["Twelve spaces, six per side, with a pawn each near the center. The number of empty spaces between the pawns is the <b>distance</b>, and it powers the suit modifiers below."],
            },
            {
                h: "A round, step by step",
                p: [
                    "<b>1. Swap window</b> — before the manilha is revealed you may swap any number of cards from your hand (limited budget for the whole game). Swapped cards are revealed to the graveyard.",
                    "<b>2. Manilha</b> — a card is drawn from the ♣ deck. Every card of that rank is worth 14 this round. If a face card or Ace is drawn, there is no manilha.",
                    "<b>3. Pick</b> — both players secretly choose one card from hand.",
                    "<b>4. Reveal & resolve</b> — the cards are compared; the winner pushes the loser and then moves.",
                ],
            },
            {
                h: "Card values",
                p: [
                    "Cards run 2 (low) up to A. The base value is the rank; distance modifiers adjust it:",
                    "♠ <b>Sword</b> — stronger up close (+3 at distance 0), weaker far.",
                    "♦ <b>Bow</b> — stronger at range (+3 at distance 5+), weaker up close.",
                    "♥ <b>Magic</b> — ignores distance entirely.",
                    "A manilha-rank card is a flat 14 and ignores modifiers.",
                ],
            },
            {
                h: "Suit order & ties",
                p: ["Equal values are broken by the suit cycle: ♥ beats ♦, ♦ beats ♠, ♠ beats ♥. If the cycle cannot decide (same suit), the round is a tie and both pawns retreat 1."],
            },
            {
                h: "Special cards",
                p: [
                    "<b>A (Ace)</b> — the winner is decided purely by suit order, ignoring the numbers. Losing against an Ace retreats you 2.",
                    "<b>K (King)</b> — removes all distance modifiers this round; its winner pushes the loser up to 3. Losing <b>with</b> a K sends you back to your own first space.",
                    "<b>Q (Queen)</b> — its winner may move up to 5 spaces instead of 2. Losing with a Q is a normal loss.",
                    "<b>J (Jack)</b> — inverts the round result: the apparent loser wins. Two Js cancel out (tie); a J inverting a tie stays a tie.",
                ],
            },
            {
                h: "Winner's move",
                p: [
                    "The loser's forced movement resolves first; then you move your own pawn 0–2 spaces either way (0–5 with a Q) to set up the distance for next round. Pawns never pass or share a space, and you cannot retreat off your own edge on purpose.",
                ],
            },
            {
                h: "Danger zone",
                p: ["While you stand on your first space, your opponent must reveal their card before you pick yours. If you tie while on your danger space, you lose."],
            },
        ],
    },

    pt: {
        // --- menu & lobby ---
        "menu.tagline": "Empurre seu oponente para fora do tabuleiro.",
        "menu.createRoom": "Criar sala",
        "menu.createHint": "Você receberá um código curto para compartilhar com seu oponente.",
        "menu.or": "ou",
        "menu.roomCodePlaceholder": "Código da sala",
        "menu.joinRoom": "Entrar",
        "menu.newHotseat": "Novo jogo local",
        "menu.hotseatHint": "Dois jogadores, um dispositivo — modo de depuração.",
        "lobby.roomCode": "Código da sala",
        "lobby.shareHint": "Compartilhe este código — o jogo começa quando seu oponente entrar.",
        "lobby.copyLink": "Copiar link de convite",
        "lobby.linkCopied": "Link copiado!",
        "lobby.waiting": "Aguardando seu oponente entrar…",
        "lobby.connecting": "Conectando ao servidor…",
        "common.cancel": "Cancelar",
        "common.close": "Fechar",
        "common.backToMenu": "Voltar ao menu",

        // --- curtain (hotseat) ---
        "curtain.lastRound": "Última rodada",
        "curtain.pass": ({ n }) => `Passe o dispositivo para o Jogador ${n}`,
        "curtain.continue": ({ n }) => `Sou o Jogador ${n} — continuar`,

        // --- player names ---
        "player.you": "Você",
        "player.opponent": "Oponente",
        "player.n": ({ n }) => `Jogador ${n}`,

        // --- connection banners ---
        "banner.connectionLost": "Conexão perdida — reconectando…",
        "banner.opponentDisconnected": "Seu oponente se desconectou — aguardando o retorno dele…",

        // --- sidebar ---
        "side.lastRound": "Última rodada",
        "side.roundLog": "Histórico de rodadas",

        // --- round-history log ---
        "log.tie": "Empate",
        "log.youWon": "Você venceu",
        "log.wonBy": ({ label }) => `${label} venceu`,

        // --- swap window ---
        "swap.closed": "Janela de troca fechada — aguardando seu oponente…",
        "swap.instructions": ({ seat, remaining }) => `${seat}: selecione cartas para trocar ou mantenha sua mão.`,
        "swap.selected": ({ n }) => `Trocar selecionadas (${n})`,
        "swap.done": "Pronto — manter a mão",

        // --- pick phase ---
        "pick.committed": "Carta confirmada — aguardando seu oponente…",
        "pick.dangerTitle": "Zona de perigo!",
        "pick.openWaiting": "Seu oponente precisa jogar aberto primeiro — aguardando a carta dele…",
        "pick.openRevealed": "Seu oponente teve que jogar aberto:",
        "pick.opponentInDangerTitle": "Seu oponente está em perigo.",
        "pick.opponentInDangerBody": "Você deve jogar aberto — ele verá sua carta antes de escolher a dele.",
        "pick.instructions": ({ seat }) => `${seat}: escolha uma carta para jogar. Ela fica secreta até ambos confirmarem.`,
        "pick.play": "Jogar carta selecionada",

        // --- winner move ---
        "move.waiting": "Aguardando o vencedor da rodada…",
        "move.push": "Empurrar oponente (K):",
        "move.advance": ({ n }) => `Avançar ${n}`,
        "move.retreat": ({ n }) => `Recuar ${n}`,
        "move.stay": "Ficar",
        "move.introYou": ({ range }) => `Você venceu a rodada — escolha seu movimento (até ${range} para cada lado).`,
        "move.introSeat": ({ n, range }) => `Jogador ${n}, você venceu a rodada — escolha seu movimento (até ${range} para cada lado).`,
        "move.confirm": "Confirmar movimento",

        // --- game over ---
        "over.draw": "Ambos os jogadores foram empurrados para fora — o jogo é um empate!",
        "over.onlineConcededWin": "Seu oponente desistiu — você venceu o jogo!",
        "over.onlineConcededLose": "Você desistiu — seu oponente venceu o jogo.",
        "over.onlineWin": "Você venceu o jogo!",
        "over.onlineLose": "Você perdeu — seu oponente venceu o jogo.",
        "over.hotseatConceded": ({ conceder, winner }) => `Jogador ${conceder} desistiu — Jogador ${winner} venceu o jogo!`,
        "over.hotseatWin": ({ winner }) => `Jogador ${winner} venceu o jogo!`,
        "over.rematch": "Revanche",
        "over.rematchWaiting": "Aguardando o oponente…",
        "over.rematchAsked": "Revanche solicitada — aguardando seu oponente.",
        "over.opponentWantsRematch": "Seu oponente quer uma revanche!",

        // --- HUD ---
        "phase.SWAP_WINDOW": "Janela de troca",
        "phase.PICK_CARDS": "Escolher cartas",
        "phase.WINNER_MOVE": "Vencedor move",
        "phase.GAME_OVER": "Fim de jogo",
        "hud.round": ({ n }) => `Rodada ${n}`,
        "hud.youAre": ({ n }) => `Você é o Jogador ${n}`,
        "hud.classicSuits": "Naipes clássicos",
        "hud.fantasySuits": "Naipes de fantasia",
        "hud.suitsTitle": "Alternar entre naipes clássicos e armas de fantasia",
        "hud.soundOn": "Som ligado — clique para silenciar",
        "hud.soundOff": "Som desligado — clique para ativar",
        "concede.confirm": "Desistir do jogo?",
        "concede.yes": "Sim, desistir",
        "concede.keepPlaying": "Continuar jogando",
        "concede.button": "Desistir",

        // --- suit-cycle reference ---
        "cycle.title": "Ordem dos naipes",
        "cycle.note": "Cada naipe vence o próximo — desempata e decide duelos de A",

        // --- reveal panel ---
        "reveal.manilhaPlayed": "Manilha jogada — vale 14",
        "reveal.kRemoved": "K removeu os modificadores de distância",
        "reveal.suitOrder": "Decidido pela ordem dos naipes",
        "reveal.jInverted": "J inverteu o resultado!",
        "reveal.tie": "Empate — ambos os peões recuam 1",
        "reveal.youWin": "Você venceu a rodada",
        "reveal.winsRound": ({ label }) => `${label} venceu a rodada`,
        "reveal.manilhaWord": "Manilha",
        "reveal.dist": "dist",
        "effect.retreat": ({ loser, n }) => `${loser} recua ${n}`,
        "effect.returnToFirst": ({ loser }) => `${loser} volta para a primeira casa (perdeu com K)`,
        "effect.kPush": ({ winner, loser, you }) => `${winner} pode empurrar ${you ? "você" : loser} até 3 casas`,

        // --- board buff bar ---
        "buff.distance": "Distância",
        "buff.sword": "Espada",
        "buff.bow": "Arco",
        "buff.magic": "Magia",

        // --- opponent row & hand ---
        "chip.swapsLeft": ({ n }) => `Trocas restantes ${n}`,
        "chip.committed": "Carta confirmada",
        "hand.yours": "Sua mão",
        "hand.playerN": ({ n }) => `Mão do Jogador ${n}`,
        "hand.youPlayed": "Você jogou",

        // --- piles & manilha ---
        "piles.deck": "Baralho",
        "piles.graveyard": "Cemitério",
        "manilha.title": "Manilha",
        "manilha.beforeReveal": "Revelada após a janela de troca",
        "manilha.faceCard": "Figura — sem manilha nesta rodada",
        "manilha.everyRank": ({ rank }) => `Todo <b>${rank}</b> vale 14`,

        // --- graveyard modal ---
        "grave.title": ({ n }) => `Cemitério (${n})`,
        "grave.empty": "Vazio — nenhuma carta descartada ainda.",

        // --- language toggle & help ---
        "lang.title": ({ name }) => `Idioma: ${name} — clique para alternar`,
        "help.button": "Regras",
        "help.title": "Como jogar",

        // --- rules modal (structured sections) ---
        "rules.sections": [
            {
                h: "Objetivo",
                p: [
                    "Empurre seu oponente para fora do lado dele do tabuleiro de 12 casas. Um jogador é eliminado no instante em que é empurrado para além da própria primeira casa — sua <b>zona de perigo</b>.",
                ],
            },
            {
                h: "O tabuleiro & a distância",
                p: [
                    "Doze casas, seis por lado, com um peão de cada perto do centro. O número de casas vazias entre os peões é a <b>distância</b>, e é ela que aciona os modificadores de naipe abaixo.",
                ],
            },
            {
                h: "Uma rodada, passo a passo",
                p: [
                    "<b>1. Janela de troca</b> — antes de a manilha ser revelada, você pode trocar quantas cartas quiser da mão (com um limite para o jogo inteiro). As cartas trocadas são reveladas no cemitério.",
                    "<b>2. Manilha</b> — uma carta é sacada do baralho de ♣. Todo carta desse valor vale 14 nesta rodada. Se sair uma figura ou um Ás, não há manilha.",
                    "<b>3. Escolha</b> — ambos os jogadores escolhem secretamente uma carta da mão.",
                    "<b>4. Revelação & resolução</b> — as cartas são comparadas; o vencedor empurra o perdedor e depois se move.",
                ],
            },
            {
                h: "Valores das cartas",
                p: [
                    "As cartas vão de 2 (baixa) até A. O valor base é o número; os modificadores de distância o ajustam:",
                    "♠ <b>Espada</b> — mais forte de perto (+3 na distância 0), mais fraca de longe.",
                    "♦ <b>Arco</b> — mais forte de longe (+3 na distância 5+), mais fraco de perto.",
                    "♥ <b>Magia</b> — ignora a distância por completo.",
                    "Uma carta do valor da manilha vale 14 fixo e ignora modificadores.",
                ],
            },
            {
                h: "Ordem dos naipes & empates",
                p: [
                    "Valores iguais são desempatados pelo ciclo de naipes: ♥ vence ♦, ♦ vence ♠, ♠ vence ♥. Se o ciclo não puder decidir (mesmo naipe), a rodada é um empate e ambos os peões recuam 1.",
                ],
            },
            {
                h: "Cartas especiais",
                p: [
                    "<b>A (Ás)</b> — o vencedor é decidido só pela ordem dos naipes, ignorando os números. Perder contra um Ás faz você recuar 2.",
                    "<b>K (Rei)</b> — remove todos os modificadores de distância na rodada; seu vencedor empurra o perdedor até 3. Perder <b>com</b> um K te manda de volta à sua primeira casa.",
                    "<b>Q (Dama)</b> — seu vencedor pode se mover até 5 casas em vez de 2. Perder com uma Q é uma derrota normal.",
                    "<b>J (Valete)</b> — inverte o resultado da rodada: o aparente perdedor vence. Dois J se anulam (empate); um J que inverteria um empate mantém o empate.",
                ],
            },
            {
                h: "O movimento do vencedor",
                p: [
                    "O movimento forçado do perdedor resolve primeiro; depois você move seu próprio peão de 0 a 2 casas para qualquer lado (0 a 5 com uma Q) para ajustar a distância da próxima rodada. Peões nunca se ultrapassam nem dividem casa, e você não pode recuar para fora da sua borda de propósito.",
                ],
            },
            {
                h: "Zona de perigo",
                p: ["Enquanto você estiver na sua primeira casa, seu oponente precisa revelar a carta dele antes de você escolher a sua. Se você empatar estando na sua zona de perigo, você perde."],
            },
        ],
    },
};

/**
 * A translator bound to one language. Returns a `t(key, params)` that resolves
 * a message: strings pass through, functions are called with params, and any
 * missing key falls back to English then to the key itself (so nothing renders
 * as `undefined`). Non-string values (e.g. rules.sections arrays) pass through.
 *
 * @param {string} lang
 * @returns {(key: string, params?: object) => any}
 */
export function createTranslator(lang) {
    const dict = messages[lang] ?? messages[DEFAULT_LANG];
    const fallback = messages[DEFAULT_LANG];
    return (key, params) => {
        const entry = dict[key] ?? fallback[key] ?? key;
        return typeof entry === "function" ? entry(params ?? {}) : entry;
    };
}
