# Moves the placeholder support address to the Shift Logistics brand. Real addresses entered
# by an admin are left untouched.
class RebrandSupportEmailShift < ActiveRecord::Migration[8.0]
  PLACEHOLDERS = %w[help@swiftship.example help@mahajanlogistics.example].freeze
  NEW = "help@shiftlogistics.example".freeze

  def up
    PLACEHOLDERS.each do |old|
      execute "UPDATE settings SET value = to_jsonb('#{NEW}'::text), updated_at = NOW() WHERE key = 'support_email' AND value = to_jsonb('#{old}'::text)"
    end
  end

  def down; end
end
