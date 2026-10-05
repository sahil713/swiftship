# Replaces the old placeholder support address (shown on the Contact page) with the
# Mahajan Logistics placeholder. Leaves any real address an admin has entered untouched.
class RebrandSupportEmail < ActiveRecord::Migration[8.0]
  OLD = "help@swiftship.example".freeze
  NEW = "help@mahajanlogistics.example".freeze

  def up
    execute <<~SQL
      UPDATE settings SET value = to_jsonb('#{NEW}'::text), updated_at = NOW()
      WHERE key = 'support_email' AND value = to_jsonb('#{OLD}'::text)
    SQL
  end

  def down
    execute <<~SQL
      UPDATE settings SET value = to_jsonb('#{OLD}'::text), updated_at = NOW()
      WHERE key = 'support_email' AND value = to_jsonb('#{NEW}'::text)
    SQL
  end
end
