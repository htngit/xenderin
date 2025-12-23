# Database Schema

This document outlines the schema for the `user_quotas` and `subscriptions` tables in the Supabase database.

## `subscriptions` table

| Column | Data Type | Nullable | Description |
|---|---|---|---|
| id | uuid | NO | Primary key for the subscription. |
| master_user_id | uuid | YES | Foreign key to the master user account. |
| plan_type | text | NO | The type of subscription plan (e.g., 'basic', 'premium'). |
| billing_cycle | text | YES | The billing cycle for the subscription (e.g., 'monthly', 'yearly'). |
| status | text | YES | The current status of the subscription (e.g., 'active', 'canceled'). |
| price | numeric | YES | The price of the subscription. |
| currency | text | YES | The currency of the price. |
| valid_from | timestamp with time zone | YES | The date the subscription becomes valid. |
| valid_until | timestamp with time zone | YES | The date the subscription expires. |
| next_billing_date | timestamp with time zone | YES | The date of the next billing cycle. |
| quota_reset_date | timestamp with time zone | YES | The date the user's quota will reset. |
| auto_renew | boolean | YES | Whether the subscription will automatically renew. |
| scheduled_downgrade_to | text | YES | The plan to which the subscription will be downgraded. |
| scheduled_downgrade_date | timestamp with time zone | YES | The date the downgrade is scheduled to occur. |
| grace_period_ends_at | timestamp with time zone | YES | The end of the grace period for a past-due subscription. |
| created_at | timestamp with time zone | YES | The timestamp when the subscription was created. |
| updated_at | timestamp with time zone | YES | The timestamp when the subscription was last updated. |

## `user_quotas` table

| Column | Data Type | Nullable | Description |
|---|---|---|---|
| id | uuid | NO | Primary key for the user quota. |
| user_id | uuid | NO | Foreign key to the user. |
| master_user_id | uuid | NO | Foreign key to the master user account. |
| plan_type | text | NO | The type of plan associated with this quota. |
| messages_limit | integer | NO | The total number of messages allowed in the quota. |
| messages_used | integer | NO | The number of messages already used. |
| reset_date | date | NO | The date the quota will reset. |
| is_active | boolean | YES | Whether this quota is currently active. |
| created_at | timestamp with time zone | YES | The timestamp when the quota was created. |
| updated_at | timestamp with time zone | YES | The timestamp when the quota was last updated. |