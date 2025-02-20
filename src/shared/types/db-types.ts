import { Graph } from './graph';
import { Node } from './node';
import { Edge } from './edge';

/**
 * Database Types
 * These types represent entities as they exist in the user's database
 */
export interface DbNode extends Node {
  readonly __db: unique symbol;  // Nominal typing
}

export interface DbEdge extends Edge {
  readonly __db: unique symbol;  // Nominal typing
}

export interface DbGraph extends Graph {
  readonly __db: unique symbol;  // Nominal typing
} 