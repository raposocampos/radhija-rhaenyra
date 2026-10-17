import { events } from '../../src/core/events.js';
import { createGameEvents } from '../../src/game/gameEvents.js';

const gameEvents = createGameEvents({ dispatch: events.emit, now: () => 0, rumble() {} });
gameEvents.emit('game:state', { state: 'playing', prev: 'intro', level: 0 });
gameEvents.emit('level:error', { index: 0, initial: true, canReturn: false, message: 'Falha controlada' });
// @ts-expect-error a extração mantém o payload obrigatório de carregamento
gameEvents.emit('level:loaded');
// @ts-expect-error o emissor extraído rejeita estados desconhecidos
gameEvents.emit('game:state', { state: 'inventado', prev: 'intro', level: 0 });
// @ts-expect-error recuperação exige canReturn booleano também neste emissor
gameEvents.emit('level:error', { index: 0, initial: true, canReturn: 'sim', message: 'Inválido' });
gameEvents.emit('mecanica:personalizada', { valor: 1 });
