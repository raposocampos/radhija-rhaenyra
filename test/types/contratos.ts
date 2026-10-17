// Somente checagem estática: incluído no typecheck do CI, sem emissão nem execução.
// @ts-expect-error também reprova se uma fronteira voltar a any e deixar de detectar o erro.
import type * as THREE from 'three';
import type {
  BafoProps, Fase1Props, Fase2Props, Fase3Props, Fase4Props, Fase5Props,
  LevelBuildArgs, LevelDef, LevelProps, PlaceholderProps, PuzzleContext,
} from '../../src/types';
import { events } from '../../src/core/events.js';
import fase4 from '../../src/levels/fase4/index.js';
import { buildWorld as buildFase1 } from '../../src/levels/fase1/world.js';
import { createPuzzle as createFase1Puzzle } from '../../src/levels/fase1/puzzle.js';
import { buildProps as buildFase2Props } from '../../src/levels/fase2/world/props.js';
import { createProps as buildFase3Props } from '../../src/levels/fase3/world/props.js';
import { buildProps as buildFase4Props } from '../../src/levels/fase4/world/props.js';
import { buildProps as buildFase5Props } from '../../src/levels/fase5/world/props.js';
import {
  stubFase1Props, stubFase2Props, stubFase3Props, stubFase4Props, stubFase5Props,
  stubPlaceholderProps, stubBafoProps,
} from '../helpers/props.mjs';

declare const root: THREE.Group;
declare const args: LevelBuildArgs;
declare const context: PuzzleContext<Fase4Props>;
declare const common: LevelProps;

// O produtor e o consumidor concretos não podem ser trocados por outra fase.
const correct: LevelDef<Fase4Props> = fase4;
const wrongWorld: LevelDef<Fase4Props> = {
  ...fase4,
  // @ts-expect-error cenário da fase 1 não produz os props da fase 4
  build: buildFase1,
};
const wrongLazyWorld: LevelDef<Fase4Props> = {
  ...fase4,
  // @ts-expect-error o import sob demanda também deve preservar o tipo dos props
  load: async () => ({ build: buildFase1 }),
};
const wrongPuzzle: LevelDef<Fase4Props> = {
  ...fase4,
  // @ts-expect-error puzzle da fase 1 não recebe os props da fase 4
  createPuzzle: createFase1Puzzle,
};
// @ts-expect-error props comuns não aceitam propriedades inventadas
common.propInventado.setOpen(1);
// @ts-expect-error PuzzleContext não deve apagar o tipo dos props
context.props.duck.metodoInventado();
// @ts-expect-error altura da placa é número, não texto nem função criada por dublê
context.props.plate.surfaceY.toUpperCase();
// @ts-expect-error a altura é lida do cenário, não escrita pelo puzzle
context.props.plate.surfaceY = 3;
context.props.pigeon.setPose({ flying: true, flightProgress: 0.8 });

// Conferir as factories reais também, sem depender só de buildWorld já anotado.
declare const real2: ReturnType<typeof buildFase2Props>;
declare const real3: ReturnType<typeof buildFase3Props>['props'];
declare const real4: ReturnType<typeof buildFase4Props>['props'];
declare const real5: ReturnType<typeof buildFase5Props>['props'];
const world2: Fase2Props = real2;
const world3: Fase3Props = real3;
const world4: Fase4Props = real4;
const world5: Fase5Props = real5;
// @ts-expect-error a factory real não pode devolver any no lugar dos props
real2.gate.metodoInventado();
// @ts-expect-error a factory real não pode devolver any no lugar dos props
real3.plateH.metodoInventado();
// @ts-expect-error a factory real não pode devolver any no lugar da placa
real4.plate.metodoInventado();
// @ts-expect-error a factory real não pode devolver any no lugar dos props
real5.petGate.metodoInventado();

// As factories de teste participam do mesmo typecheck, sem importar navegador/headless.
const fake1: Fase1Props = stubFase1Props(root, args.layout);
const fake2: Fase2Props = stubFase2Props(root, args.layout);
const fake3: Fase3Props = stubFase3Props(root, args.layout);
const fake4: Fase4Props = stubFase4Props(root, args.layout);
const fake5: Fase5Props = stubFase5Props(root, args.layout);
const placeholder: PlaceholderProps = stubPlaceholderProps(root, args.layout);
const bafo: BafoProps = stubBafoProps(root, args.layout);
// @ts-expect-error a factory de teste não deve devolver any
stubFase4Props(root, args.layout).plate.metodoInventado();
// @ts-expect-error item do placeholder não promete home, ausente no cenário real
placeholder.item.home.copy(root.position);

events.emit('level:error', { index: 0, initial: false, canReturn: true, message: 'Falha controlada' });
events.emit('game:state', { state: 'load-error', prev: 'loading', level: 0 });
// @ts-expect-error erro de carregamento exige ação de recuperação explícita
events.emit('level:error', { index: 0, initial: false, message: 'Falta canReturn' });
// @ts-expect-error o nome literal não pode ser alargado para aceitar uma recuperação malformada
events.emit('level:error', { index: 0, initial: false, canReturn: 'sim', message: 'Inválido' });
// @ts-expect-error erro de escrita não substitui a ação canReturn exigida pelo evento
events.emit('level:error', { index: 0, initial: false, canResume: 'sim', message: 'Inválido' });
// @ts-expect-error índice de fase é numérico mesmo na API pública do barramento
events.emit('level:loaded', { index: '0', count: 5, id: 'fase4', number: 4, name: 'Patinho', item: 'duck', texts: {}, total: 3, hasNext: true });
// @ts-expect-error estado desconhecido não faz parte do ciclo de vida
events.emit('game:state', { state: 'inventado', prev: 'loading', level: 0 });
// @ts-expect-error eventos de carregamento não podem omitir o payload obrigatório
events.emit('level:loaded');
// Fronteira ainda aberta: eventos próprios das mecânicas, sem catálogo completo nesta etapa.
events.emit('mecanica:personalizada', { valor: 1 });

void [correct, wrongWorld, wrongLazyWorld, wrongPuzzle, world2, world3, world4, world5,
  fake1, fake2, fake3, fake4, fake5, placeholder, bafo];
