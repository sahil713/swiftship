# Emails the admin team a complete copy of a new customer request so they can
# call the customer and agree a price (phase 1 – no online pricing).
class EnquiryNotifier
  def self.recipients
    configured = Setting.get(:enquiry_notification_email).to_s.split(/[,;\s]+/).reject(&:blank?)
    configured.presence || User.where(role: "admin", active: true).pluck(:email)
  end

  def self.new_request(booking)
    to = recipients
    return Rails.logger.warn("No admin recipients for enquiry #{booking.reference}") if to.empty?

    mail = AdminMailer.new_enquiry(booking, to:)
    status = begin
      mail.deliver_now
      ApplicationMailer.delivers? ? "sent" : "not_sent"
    rescue StandardError => e
      Rails.logger.error("Enquiry email failed for #{booking.reference}: #{e.class}: #{e.message}")
      "failed"
    end
    booking.notifications.create!(channel: "email", recipient: to.join(", "), subject: mail.subject,
                                  body: mail.text_part&.decoded.presence || mail.body.decoded, status:)
  rescue StandardError => e
    Rails.logger.error("Enquiry notification error for #{booking.reference}: #{e.message}")
  end

  # Contact-form messages go to the same admin address as quote requests.
  def self.new_contact(enquiry)
    to = recipients
    return enquiry.update_column(:email_status, "no_recipient") if to.empty?

    status = begin
      AdminMailer.new_contact_enquiry(enquiry, to:).deliver_now
      ApplicationMailer.delivers? ? "sent" : "not_sent"
    rescue StandardError => e
      Rails.logger.error("Contact enquiry email failed for ##{enquiry.id}: #{e.class}: #{e.message}")
      "failed"
    end
    enquiry.update_column(:email_status, status)
  end
end
