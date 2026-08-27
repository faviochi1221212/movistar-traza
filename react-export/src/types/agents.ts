export type AgentId = 'orchestrator' | 'billing' | 'collections' | 'revenue' | 'bi';

export type AgentStatus = 'idle' | 'processing' | 'waiting' | 'attention' | 'completed';

export type AgentEventType =
  | 'source_loaded'
  | 'validation_completed'
  | 'exception_detected'
  | 'conformity_requested'
  | 'conformity_received'
  | 'invoice_issued'
  | 'handoff'
  | 'collection_strategy_created'
  | 'email_sent'
  | 'email_received'
  | 'payment_detected'
  | 'payment_matched'
  | 'reconciliation_completed'
  | 'balance_updated'
  | 'risk_updated'
  | 'pattern_detected'
  | 'strategy_recommended'
  | 'rule_published';

export interface AgentEvent {
  id: string;
  timestamp: string;
  source: AgentId;
  target?: AgentId;
  type: AgentEventType;
  entityId?: string;
  title: string;
  detail?: string;
  severity?: 'normal' | 'success' | 'warning' | 'critical';
}

export interface DemoScenario {
  id: string;
  title: string;
  events: AgentEvent[];
}

export const AGENT_LABEL: Record<AgentId, string> = {
  orchestrator: 'Orquestador',
  billing: 'Facturación',
  collections: 'Cobranzas',
  revenue: 'Recaudo',
  bi: 'BI',
};
