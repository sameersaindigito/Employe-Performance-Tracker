import type { Task, FilterState } from '../types';

export function applyClientFilters(tasks: Task[], filters: FilterState): Task[] {
  return tasks.filter((task) => {
    if (filters.leader && task.teamLeader !== filters.leader) return false;
    if (filters.designer && !task.designerName.toLowerCase().includes(filters.designer.toLowerCase())) return false;
    if (filters.deliverable && task.deliverable !== filters.deliverable) return false;
    if (filters.category) {
      if (task.category.toLowerCase() !== filters.category.toLowerCase()) return false;
    }
    if (filters.month) {
      const taskMonth = task.date?.slice(0, 7);
      if (taskMonth !== filters.month) return false;
    }
    return true;
  });
}

export function getUniqueDesigners(tasks: Task[]): string[] {
  return [...new Set(tasks.map((t) => t.designerName).filter(Boolean))].sort();
}

export function getUniqueLeaders(tasks: Task[]): string[] {
  return [...new Set(tasks.map((t) => t.teamLeader).filter(Boolean))].sort();
}

export function getUniqueDeliverables(tasks: Task[]): string[] {
  return [...new Set(tasks.map((t) => t.deliverable).filter(Boolean))].sort();
}

export function getUniqueCategories(tasks: Task[]): string[] {
  return [...new Set(tasks.map((t) => t.category).filter(Boolean))].sort();
}

export function getAvailableMonths(tasks: Task[]): string[] {
  const months = [...new Set(tasks.map((t) => t.date?.slice(0, 7)).filter(Boolean))];
  return months.sort().reverse();
}
