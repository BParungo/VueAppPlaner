import type { FlowEdgeShape, FlowNodeShape } from '@/lib/yjs/doc';
import { asTypedFields, type TypedField } from '@/schemas/nodes';
import { typesEqual } from './compare';

export type FieldStatus = 'match' | 'type-mismatch' | 'missing' | 'unused';

export interface PropMatchEntry {
  field: TypedField;
  status: 'match' | 'type-mismatch' | 'missing';
  matchedFromSourceId?: string;
  expectedType?: string;
  actualType?: string;
}

export interface UnusedFieldEntry {
  field: TypedField;
  sourceId: string;
}

export interface NodeMatchReport {
  // pro Component-Prop bzw. pro emit-Sink: status + Quelle/Senke
  propStatuses: PropMatchEntry[];
  emitStatuses: PropMatchEntry[];
  // Felder von Quellen (DataSource/Store), die keine Component-Prop konsumiert
  unusedFromSources: UnusedFieldEntry[];
}

export interface EdgeMatchReport {
  edgeId: string;
  totalMismatch: boolean;
  matchCount: number;
  totalProps: number;
}

function nodeFields(
  node: FlowNodeShape,
  channel: 'output' | 'input',
): TypedField[] {
  const data = (node.data ?? {}) as Record<string, unknown>;
  if (channel === 'output') {
    // Was die Node bereitstellt (am source-Handle rauskommt)
    switch (node.type) {
      case 'dataSource':
        return asTypedFields(data.fields);
      case 'store':
        return asTypedFields(data.state);
      case 'component':
        return asTypedFields(data.emits);
      case 'composable':
        return asTypedFields(data.returns);
      default:
        return [];
    }
  }
  // 'input' = was die Node erwartet (am target-Handle reinkommt)
  switch (node.type) {
    case 'component':
      return asTypedFields(data.props);
    case 'store':
      // Ein Store kann von DataSources gespeist werden; sein "input"-Vertrag
      // ist sein eigener state.
      return asTypedFields(data.state);
    case 'composable':
      return asTypedFields(data.params);
    default:
      return [];
  }
}

function findInList(
  list: TypedField[],
  name: string,
): TypedField | undefined {
  return list.find((f) => f.name === name);
}

export function buildNodeReport(
  nodeId: string,
  allNodes: FlowNodeShape[],
  allEdges: FlowEdgeShape[],
): NodeMatchReport {
  const node = allNodes.find((n) => n.id === nodeId);
  if (!node) {
    return { propStatuses: [], emitStatuses: [], unusedFromSources: [] };
  }

  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

  // Eingehend: Was liefern die Quellen? Aggregierter Pool ueber alle incoming edges.
  const incoming = allEdges.filter((e) => e.target === nodeId);
  const incomingFieldsBySource = incoming
    .map((e) => {
      const src = nodeMap.get(e.source);
      if (!src) return null;
      return { sourceId: src.id, fields: nodeFields(src, 'output') };
    })
    .filter((s): s is { sourceId: string; fields: TypedField[] } => s !== null);

  // Ausgehend: Was erwarten die Senken (emits-Match)?
  const outgoing = allEdges.filter((e) => e.source === nodeId);
  const outgoingExpectedBySink = outgoing
    .map((e) => {
      const sink = nodeMap.get(e.target);
      if (!sink) return null;
      return { sinkId: sink.id, fields: nodeFields(sink, 'input') };
    })
    .filter((s): s is { sinkId: string; fields: TypedField[] } => s !== null);

  // Props-Match (nur fuer Components; bei Stores stellt nodeFields(.,'input')
  // den state dar, was state-vs-source matchen wuerde)
  const inputContract = nodeFields(node, 'input');
  const propStatuses: PropMatchEntry[] = inputContract.map((prop) => {
    let bestType: string | undefined;
    let bestSourceId: string | undefined;
    let bestStatus: 'match' | 'type-mismatch' | 'missing' = 'missing';

    for (const src of incomingFieldsBySource) {
      const found = findInList(src.fields, prop.name);
      if (!found) continue;
      if (typesEqual(found.type, prop.type)) {
        bestStatus = 'match';
        bestType = found.type;
        bestSourceId = src.sourceId;
        break;
      }
      if (bestStatus === 'missing') {
        bestStatus = 'type-mismatch';
        bestType = found.type;
        bestSourceId = src.sourceId;
      }
    }

    return {
      field: prop,
      status: bestStatus,
      matchedFromSourceId: bestSourceId,
      expectedType: prop.type,
      actualType: bestType,
    };
  });

  // Emits-Match: jeder eigene emit-Eintrag muss in IRGENDEINER ausgehenden Senke
  // als input-Feld auftauchen, damit "verstanden". Ist keine ausgehende Senke
  // verbunden, lassen wir emits unmarkiert (status 'match', kein Forderungskontext).
  const ownEmits =
    node.type === 'component' ? asTypedFields(
      ((node.data ?? {}) as Record<string, unknown>).emits,
    ) : [];
  const emitStatuses: PropMatchEntry[] = ownEmits.map((emit) => {
    if (outgoingExpectedBySink.length === 0) {
      return { field: emit, status: 'match', expectedType: emit.type };
    }
    let bestType: string | undefined;
    let bestSinkId: string | undefined;
    let bestStatus: 'match' | 'type-mismatch' | 'missing' = 'missing';
    for (const sink of outgoingExpectedBySink) {
      const found = findInList(sink.fields, emit.name);
      if (!found) continue;
      if (typesEqual(found.type, emit.type)) {
        bestStatus = 'match';
        bestType = found.type;
        bestSinkId = sink.sinkId;
        break;
      }
      if (bestStatus === 'missing') {
        bestStatus = 'type-mismatch';
        bestType = found.type;
        bestSinkId = sink.sinkId;
      }
    }
    return {
      field: emit,
      status: bestStatus,
      matchedFromSourceId: bestSinkId,
      expectedType: emit.type,
      actualType: bestType,
    };
  });

  // Unused-from-sources: Felder die in Quellen liegen, die diese Component aber
  // nicht in props nimmt. Nur sinnvoll wenn Node 'component' ist.
  const unusedFromSources: UnusedFieldEntry[] = [];
  if (node.type === 'component') {
    const inputNames = new Set(inputContract.map((f) => f.name));
    for (const src of incomingFieldsBySource) {
      for (const f of src.fields) {
        if (!inputNames.has(f.name)) {
          unusedFromSources.push({ field: f, sourceId: src.sourceId });
        }
      }
    }
  }

  return { propStatuses, emitStatuses, unusedFromSources };
}

export function buildEdgeReport(
  edge: FlowEdgeShape,
  allNodes: FlowNodeShape[],
): EdgeMatchReport {
  const source = allNodes.find((n) => n.id === edge.source);
  const target = allNodes.find((n) => n.id === edge.target);
  if (!source || !target) {
    return {
      edgeId: edge.id,
      totalMismatch: false,
      matchCount: 0,
      totalProps: 0,
    };
  }

  const sourceFields = nodeFields(source, 'output');
  const targetExpects = nodeFields(target, 'input');

  if (targetExpects.length === 0) {
    return {
      edgeId: edge.id,
      totalMismatch: false,
      matchCount: 0,
      totalProps: 0,
    };
  }

  let matchCount = 0;
  for (const prop of targetExpects) {
    const provided = findInList(sourceFields, prop.name);
    if (provided && typesEqual(provided.type, prop.type)) {
      matchCount++;
    }
  }

  return {
    edgeId: edge.id,
    matchCount,
    totalProps: targetExpects.length,
    totalMismatch: matchCount === 0 && targetExpects.length > 0,
  };
}

// Hilfs-Helper: ist ein Quelle-Feld irgendwo "used"? Genutzt fuer DataSource/Store-Cards.
export function buildUnusedFromNode(
  nodeId: string,
  allNodes: FlowNodeShape[],
  allEdges: FlowEdgeShape[],
): Set<string> {
  const node = allNodes.find((n) => n.id === nodeId);
  if (!node) return new Set();
  const sourceFields = nodeFields(node, 'output');
  if (sourceFields.length === 0) return new Set();

  const sinkIds = allEdges
    .filter((e) => e.source === nodeId)
    .map((e) => e.target);
  const sinkExpectsByName = new Set<string>();
  for (const sinkId of sinkIds) {
    const sink = allNodes.find((n) => n.id === sinkId);
    if (!sink) continue;
    for (const f of nodeFields(sink, 'input')) {
      sinkExpectsByName.add(f.name);
    }
  }

  const unused = new Set<string>();
  for (const f of sourceFields) {
    if (!sinkExpectsByName.has(f.name)) unused.add(f.name);
  }
  return unused;
}
