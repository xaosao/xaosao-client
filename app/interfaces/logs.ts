export interface IAuditLogsCreate {
  action: string;
  description?: string;
  status: "success" | "failed";
  onSuccess?: any;
  onError?: any;
  model?: string;
  customer?: string;
  user?: string;
}
