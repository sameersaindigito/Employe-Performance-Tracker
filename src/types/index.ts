export interface Task {
  srNo: number;
  date: string;
  clientName: string;
  deliverable: string;
  projectId: string;
  proposedEfforts: string;
  teamLeader: string;
  designerName: string;
  category: string;
  workLink: string;
  description: string;
  taskStatus: string;
  actualEfforts: string;
  effortsApproved: string;
  dateApproved: string;
  timesheetPunched: string;
  timesheetDate: string;
  punchedHours: string;
  portfolio: string;
  rating1: number | null;
  rating2: number | null;
  rating3: number | null;
  averageRating: number | null;
  status: string;
  tabName: string;
}

export interface RevenueItem {
  srNo: number;
  clientName: string;
  projectId: string;
  leader: string;
  category: string;
  totalHours: number;
  paymentMode: string;
  paymentChannel: string;
  hourlyRate: number;
  totalRevenue: number;
  month: string;
}

export interface PortfolioItem {
  srNo: number;
  platform: string;
  workLink: string;
}

export interface DesignerStats {
  name: string;
  teamLeader: string;
  totalTasks: number;
  averageRating: number | null;
  weightedScore: number | null;
  eligible: boolean;
  status: 'Excellent' | 'Good' | 'Average' | 'Needs Improvement' | 'No Rating';
}

export interface FilterState {
  month: string;
  leader: string;
  designer: string;
  deliverable: string;
  category: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T[];
  total?: number;
}