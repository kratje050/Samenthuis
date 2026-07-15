export function summarizeExpenses(expenses) {
  return expenses.reduce((summary, item) => {
    const amount = Number(item.amount || 0);
    summary.total += amount;
    summary.byCategory[item.category] = (summary.byCategory[item.category] || 0) + amount;
    summary.byMember[item.paidBy] = (summary.byMember[item.paidBy] || 0) + amount;
    return summary;
  }, { total: 0, byCategory: {}, byMember: {} });
}
