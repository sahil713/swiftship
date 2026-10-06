class Setting < ApplicationRecord
  DEFAULTS = {
    "northern_ireland_enabled" => true,
    "auto_confirm_quotes" => true,
    # Phase 1: no online pricing – customers submit an enquiry and staff quote by phone.
    "pricing_enabled" => false,
    # Drivers must capture a signature with the proof of collection.
    "require_collection_signature" => true,
    # Where new enquiries are emailed. Blank = every active admin user.
    "enquiry_notification_email" => "",
    "support_email" => "help@shiftlogistics.example",
    "support_phone" => "0330 123 4567"
  }.freeze

  validates :key, presence: true, uniqueness: true, inclusion: { in: DEFAULTS.keys }

  def self.get(key)
    record = find_by(key: key.to_s)
    record.nil? ? DEFAULTS.fetch(key.to_s) : record.value
  end

  def self.set(key, value)
    record = find_or_initialize_by(key: key.to_s)
    record.update!(value:)
  end

  def self.all_values
    DEFAULTS.merge(all.to_h { [_1.key, _1.value] })
  end
end
