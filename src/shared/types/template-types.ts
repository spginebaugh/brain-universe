import { Graph } from './graph';
import { Node } from './node';
import { Edge } from './edge';

/**
 * Template Types
 * These types represent entities as they exist in the template collection
 */
export interface TemplateNode extends Node {
  readonly __template: unique symbol;  // Nominal typing
}

export interface TemplateEdge extends Edge {
  readonly __template: unique symbol;  // Nominal typing
}

export interface TemplateGraph extends Graph {
  readonly __template: unique symbol;  // Nominal typing
}
