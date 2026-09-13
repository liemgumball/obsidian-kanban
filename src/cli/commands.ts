import update from 'immutability-helper';
import type { Board, Lane } from 'src/components/types';
import { LaneTemplate } from 'src/components/types';
import { generateInstanceId } from 'src/components/helpers';
import { getTaskStatusDone } from 'src/parsers/helpers/inlineMetadata';

import {
  BoardError,
  createItem,
  findCard,
  findLane,
  insertionIndex,
  reviseItem,
} from './board';

export interface LaneListing {
  title: string;
  cards: Array<{ index: number; title: string; done: boolean }>;
}

export function listBoard(board: Board): LaneListing[] {
  return board.children.map((lane) => ({
    title: lane.data.title,
    cards: lane.children.map((item, index) => ({
      index,
      title: item.data.titleRaw,
      done: !!item.data.checked,
    })),
  }));
}

export function addCard(
  board: Board,
  args: { lane: string; text: string; pos?: number }
): Board {
  const { index: laneIndex, lane } = findLane(board, args.lane);
  const at = insertionIndex(lane.children.length, args.pos);

  return update(board, {
    children: { [laneIndex]: { children: { $splice: [[at, 0, createItem(board, args.text)]] } } },
  });
}

export function editCard(
  board: Board,
  args: { lane: string; index: number; text: string }
): Board {
  const { laneIndex, item } = findCard(board, args.lane, args.index);

  return update(board, {
    children: {
      [laneIndex]: { children: { [args.index]: { $set: reviseItem(board, item, args.text) } } },
    },
  });
}

export function removeCard(board: Board, args: { lane: string; index: number }): Board {
  const { laneIndex } = findCard(board, args.lane, args.index);

  return update(board, {
    children: { [laneIndex]: { children: { $splice: [[args.index, 1]] } } },
  });
}

export function setDone(
  board: Board,
  args: { lane: string; index: number; undo?: boolean }
): Board {
  const { laneIndex } = findCard(board, args.lane, args.index);
  const checked = !args.undo;

  return update(board, {
    children: {
      [laneIndex]: {
        children: {
          [args.index]: {
            data: {
              checked: { $set: checked },
              checkChar: { $set: checked ? getTaskStatusDone() : ' ' },
            },
          },
        },
      },
    },
  });
}

export function moveCard(
  board: Board,
  args: { lane: string; index: number; to: string; pos?: number }
): Board {
  const { laneIndex: fromLane, item } = findCard(board, args.lane, args.index);
  const { index: toLane } = findLane(board, args.to);

  const removed = update(board, {
    children: { [fromLane]: { children: { $splice: [[args.index, 1]] } } },
  });

  const at = insertionIndex(removed.children[toLane].children.length, args.pos);

  return update(removed, {
    children: { [toLane]: { children: { $splice: [[at, 0, item]] } } },
  });
}

export function addLane(board: Board, args: { name: string; pos?: number }): Board {
  if (board.children.some((lane) => lane.data.title === args.name)) {
    throw new BoardError(`There is already a lane named "${args.name}"`);
  }

  const lane: Lane = {
    ...LaneTemplate,
    id: generateInstanceId(),
    children: [],
    data: { title: args.name, shouldMarkItemsComplete: false },
  };

  const at = insertionIndex(board.children.length, args.pos);

  return update(board, { children: { $splice: [[at, 0, lane]] } });
}

export function removeLane(board: Board, args: { name: string }): Board {
  const { index } = findLane(board, args.name);

  return update(board, { children: { $splice: [[index, 1]] } });
}
