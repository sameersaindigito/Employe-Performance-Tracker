import { API_URL } from '../config/env';
import type { Task, PortfolioItem, FilterState, ApiResponse, RevenueItem } from '../types';
import { normalizeName } from './names';

function buildParams(filters: Partial<FilterState>): URLSearchParams {
  const params = new URLSearchParams({ action: 'getData' });
  if (filters.month) params.set('month', filters.month);
  if (filters.leader) params.set('leader', filters.leader);
  if (filters.designer) params.set('designer', filters.designer);
  if (filters.deliverable) params.set('deliverable', filters.deliverable);
  if (filters.category) params.set('category', filters.category);
  return params;
}

export async function fetchTasks(
  filters: Partial<FilterState> = {}
): Promise<Task[]> {
  const params = buildParams(filters);
  const url = `${API_URL}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = (await res.json()) as ApiResponse<Record<string, unknown>>;
  if (!json.success) throw new Error('API returned success: false');
  return (json.data ?? []).map((raw): Task => ({
    srNo:             Number(raw['srNo']) || 0,
    date:             String(raw['date'] ?? ''),
    clientName:       String(raw['clientName'] ?? ''),
    deliverable:      String(raw['deliverable'] ?? ''),
    projectId:        String(raw['projectId'] ?? ''),
    proposedEfforts:  String(raw['proposedEfforts'] ?? ''),
    // Normalized here, once, at ingestion — every downstream grouping
    // (Leaderboard, DOTM/IT Ops Champion, revenue attribution, filter
    // dropdowns) keys off these fields directly, so a name that's clean
    // here is clean everywhere without scattering .trim() calls around.
    teamLeader:       normalizeName(raw['teamLeader'] as string | null | undefined),
    designerName:     normalizeName(raw['designerName'] as string | null | undefined),
    category:         String(raw['category'] ?? ''),
    workLink:         String(raw['workLink'] ?? ''),
    description:      String(raw['description'] ?? ''),
    taskStatus:       String(raw['taskStatus'] ?? ''),
    actualEfforts:    String(raw['actualEfforts'] ?? ''),
    effortsApproved:  String(raw['effortsApproved'] ?? ''),
    dateApproved:     String(raw['dateApproved'] ?? ''),
    timesheetPunched: String(raw['timesheetPunched'] ?? ''),
    timesheetDate:    String(raw['timesheetDate'] ?? ''),
    punchedHours:     String(raw['punchedHours'] ?? ''),
    portfolio:        String(raw['portfolio'] ?? ''),
    rating1:       raw['rating1'] != null ? Number(raw['rating1']) : null,
    rating2:       raw['rating2'] != null ? Number(raw['rating2']) : null,
    rating3:       raw['rating3'] != null ? Number(raw['rating3']) : null,
    averageRating: raw['averageRating'] != null ? Number(raw['averageRating']) : null,
    status:        String(raw['status'] ?? ''),
    tabName:       String(raw['tabName'] ?? ''),
  }));
}

export async function fetchPortfolio(): Promise<PortfolioItem[]> {
  const url = `${API_URL}?action=getPortfolio`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = (await res.json()) as ApiResponse<PortfolioItem>;
  if (!json.success) throw new Error('API returned success: false');
  return json.data ?? [];
}

export async function fetchRevenue(
  filters: Partial<{ month: string; leader: string; category: string }> = {}
): Promise<RevenueItem[]> {
  const params = new URLSearchParams({ action: 'getRevenue' });
  if (filters.month) params.set('month', filters.month);
  if (filters.leader) params.set('leader', filters.leader);
  if (filters.category) params.set('category', filters.category);
  const url = `${API_URL}?${params.toString()}`;
  const res = await fetch(url);
  const json = await res.json();
  return (json.data ?? []).map((raw: Record<string, unknown>): RevenueItem => ({
    srNo:           Number(raw['srNo']) || 0,
    clientName:     String(raw['clientName'] ?? ''),
    projectId:      String(raw['projectId'] ?? ''),
    // Same normalization as Task.teamLeader — RevenueItem.leader is matched
    // against Task.teamLeader throughout the Revenue page (filters, team
    // breakdown), so both must be keyed the same way or a leader whose name
    // has inconsistent whitespace in one sheet but not the other would fail
    // to match between the two.
    leader:         normalizeName(raw['leader'] as string | null | undefined),
    category:       String(raw['category'] ?? ''),
    totalHours:     Number(raw['totalHours']) || 0,
    paymentMode:    String(raw['paymentMode'] ?? ''),
    paymentChannel: String(raw['paymentChannel'] ?? ''),
    hourlyRate:     Number(raw['hourlyRate']) || 0,
    totalRevenue:   Number(raw['totalRevenue']) || 0,
    month:          String(raw['month'] ?? ''),
  }));
}

export async function triggerSync(): Promise<void> {
  const url = `${API_URL}?action=sync`;
  await fetch(url);
}