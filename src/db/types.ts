export class Filename {
  id!: number;
  job_id!: number;
  file_name!: string;
  output_file_name!: string;
  status!: string;
}

export class Jobs {
  finished_files!: number;
  id!: number;
  user_id!: number;
  date_created!: string;
  status!: string;
  num_files!: number;
  files_detailed!: Filename[];
}

export class User {
  id!: number;
  email!: string;
  password!: string;
  role!: "admin" | "user";
  tier!: "free" | "pro" | "business";
  created_at!: string;
  paddle_customer_id!: string | null;
  paddle_subscription_id!: string | null;
  subscription_status!: string | null;
  subscription_event_at!: string | null;
  google_id!: string | null;
  display_name!: string | null;
  avatar_path!: string | null;
  password_set!: string | null;
}

export class Tier {
  id!: string;
  name!: string;
  price!: string;
  billing_period!: string;
  description!: string;
  max_file_size_mb!: number;
  daily_conversions!: number;
  priority_queue!: number;
  batch_limit!: number;
  is_popular!: number;
  badge!: string;
  features!: string; // JSON array of strings
  button_text!: string;
  button_link!: string;
  color_theme!: string;
  retention_hours!: number;
}

export class SystemSetting {
  key!: string;
  value!: string;
}
