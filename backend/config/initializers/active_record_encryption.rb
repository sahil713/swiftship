# Keys for encrypting sensitive columns (driver licence, passport and bank details).
# Derived from secret_key_base so no extra secrets are needed; set the ACTIVE_RECORD_ENCRYPTION_*
# variables to manage keys separately. Changing SECRET_KEY_BASE without them makes existing
# encrypted values unreadable.
Rails.application.configure do
  generator = ActiveSupport::KeyGenerator.new(Rails.application.secret_key_base, iterations: 1000)
  config.active_record.encryption.primary_key = ENV.fetch("ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY") { generator.generate_key("ar-encryption/primary", 32).unpack1("H*") }
  config.active_record.encryption.deterministic_key = ENV.fetch("ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY") { generator.generate_key("ar-encryption/deterministic", 32).unpack1("H*") }
  config.active_record.encryption.key_derivation_salt = ENV.fetch("ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT") { generator.generate_key("ar-encryption/salt", 32).unpack1("H*") }
end
