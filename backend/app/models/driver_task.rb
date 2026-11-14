# One task for a driver on a job.
#
# collection: assigned → started → arrived → [POC] → collected (collection completed, in transit)
#             → at_depot (depot proof) → closed                       – then a delivery task is created
# delivery:   assigned → started → arrived_delivery → [POD] → delivered (delivery completed) → closed
# direct:     assigned → started → arrived → [POC] → collected (in transit) → arrived_delivery → [POD]
#             → delivered → closed
#
# Every action is recorded as an append-only TaskEvent (who, when, GPS where available) and the
# key moments are timestamped on the task, so each stage can be timed. Proofs can be corrected
# until their stage is completed; every change to a saved proof is kept in the audit log.
# "completed" is the closed state of tasks finished before the step-by-step workflow.
class DriverTask < ApplicationRecord
  KINDS = %w[collection delivery direct].freeze
  STATUSES = %w[unassigned assigned started arrived collected at_depot arrived_delivery delivered closed completed cancelled].freeze
  OPEN_STATUSES = %w[unassigned assigned started arrived collected at_depot arrived_delivery delivered].freeze
  FINISHED_STATUSES = %w[closed completed].freeze
  UNASSIGNABLE = %w[assigned started arrived].freeze

  class InvalidStep < StandardError; end

  belongs_to :booking
  belongs_to :driver, class_name: "User", optional: true
  has_many :proofs, class_name: "TaskProof", dependent: :restrict_with_exception
  has_many :events, -> { order(:occurred_at, :id) }, class_name: "TaskEvent", dependent: :restrict_with_exception
  has_many :locations, -> { order(:recorded_at, :id) }, class_name: "TaskLocation", dependent: :delete_all
  has_many :audit_logs, as: :auditable, dependent: :restrict_with_exception

  validates :kind, inclusion: { in: KINDS }
  validates :status, inclusion: { in: STATUSES }
  validates :driver, presence: true, unless: -> { %w[unassigned cancelled].include?(status) }
  validate :driver_is_a_driver, if: -> { driver_id_changed? && driver }

  scope :open, -> { where(status: OPEN_STATUSES) }
  scope :finished, -> { where(status: FINISHED_STATUSES) }

  def collection? = kind == "collection"
  def delivery? = kind == "delivery"
  def direct? = kind == "direct"
  def open? = OPEN_STATUSES.include?(status)
  def finished? = FINISHED_STATUSES.include?(status)
  def proof_of(kind) = proofs.detect { _1.kind == kind }
  def finished_at = closed_at || completed_at
  # Items are on board and the driver is driving to the delivery address.
  def heading_to_delivery? = (delivery? && status == "started") || (direct? && status == "collected")
  # Collection task: items picked up, driver taking them to the depot.
  def heading_to_depot? = collection? && status == "collected"
  def heading_to_collection? = !delivery? && status == "started"

  # From "Start task" until the task is closed, the driver's phone shares its position.
  SHARING_STATUSES = %w[started arrived collected at_depot arrived_delivery delivered].freeze
  def sharing_location? = SHARING_STATUSES.include?(status)

  # Where the driver is in the job, as the customer sees it.
  def live_stage
    return "to_collection" if heading_to_collection?
    return "to_delivery" if heading_to_delivery?
    return "to_depot" if heading_to_depot?
    return "at_delivery" if at_delivery_location?
    { "arrived" => "at_collection", "at_depot" => "at_depot", "delivered" => "delivered" }[status]
  end

  # The address the driver is driving to right now (collection or delivery), or nil.
  def live_destination
    side = if heading_to_collection? then "collection" elsif heading_to_delivery? then "delivery" end
    return nil unless side

    postcode = booking["#{side}_postcode"]
    found = PostcodeLookup.call(postcode)
    { side:, key: "#{side}:#{postcode}", label: "#{booking["#{side}_city"]}, #{postcode.to_s.split.first}",
      latitude: found.latitude, longitude: found.longitude }
  end

  # Phone position, sent every ~30s from Start until the task is closed: updates the live
  # position, adds to the path travelled and keeps the road route to the next address fresh.
  def record_location!(geo)
    return unless geo[:latitude] && geo[:longitude] && sharing_location?
    lat = geo[:latitude].to_f
    lng = geo[:longitude].to_f
    moved_km = live_latitude.nil? ? Float::INFINITY : LiveEta.haversine_km(live_latitude, live_longitude, lat, lng)
    place = moved_km > 0.2 || live_place.blank? ? LiveEta.place_name(lat, lng) : nil

    last = locations.last
    if last.nil? || LiveEta.haversine_km(last.latitude, last.longitude, lat, lng) > 0.025 || last.recorded_at < 2.minutes.ago
      locations.create!(latitude: lat, longitude: lng, accuracy_m: geo[:accuracy_m], recorded_at: Time.current)
    end
    update_columns(live_latitude: lat, live_longitude: lng, live_accuracy_m: geo[:accuracy_m],
                   live_place: place || (moved_km > 0.2 ? nil : live_place), live_located_at: Time.current)
    refresh_route!(lat, lng)
  end

  ROUTE_MAX_AGE = 3.minutes

  # Recalculates the road route when the destination changed, the driver has moved 300 m+
  # from where it was last worked out, or it's older than ROUTE_MAX_AGE.
  def refresh_route!(lat, lng)
    dest = live_destination
    return update_columns(live_route: nil) if dest.nil? || dest[:latitude].nil?

    current = live_route || {}
    from = current["from"]
    stale = current["dest"] != dest[:key] || from.nil? ||
            LiveEta.haversine_km(from[0], from[1], lat, lng) > 0.3 ||
            Time.zone.parse(current["computed_at"].to_s).then { _1.nil? || _1 < ROUTE_MAX_AGE.ago }
    return unless stale

    route = RouteService.route(lat, lng, dest[:latitude], dest[:longitude])
    update_columns(live_route: route.merge(dest: dest[:key], from: [lat, lng], computed_at: Time.current.iso8601))
  end

  # Times of each step so far, for the customer's tracking page.
  def milestones
    steps = case kind
            when "collection" then [["Driver set off", started_at], ["Arrived for collection", arrived_at], ["Items collected", collected_at], ["At our depot", at_depot_at]]
            when "delivery" then [["Driver set off", started_at], ["Arrived for delivery", delivery_arrival_at], ["Delivered", delivered_at]]
            else [["Driver set off", started_at], ["Arrived for collection", arrived_at], ["Items collected", collected_at],
                  ["Arrived for delivery", arrived_delivery_at], ["Delivered", delivered_at]]
            end
    steps.map { |label, at| { label:, at: } }
  end

  def delivery_arrival_at = arrived_delivery_at || (arrived_at if delivery?)

  # Which address the driver is working at right now.
  def current_side
    return "delivery" if delivery?
    return "collection" if collection?
    %w[collected arrived_delivery delivered closed completed].include?(status) ? "delivery" : "collection"
  end

  def status_label
    case status
    when "unassigned" then "Unassigned"
    when "assigned" then "Task Assigned"
    when "started" then "Task Started"
    when "arrived" then delivery? ? "Arrived at Delivery Location" : "Arrived at Collection Location"
    when "collected" then "In Transit"
    when "at_depot" then "At Depot"
    when "arrived_delivery" then "Arrived at Delivery Location"
    when "delivered" then "Delivery Completed"
    when "closed", "completed" then "Task Closed"
    when "cancelled" then "Cancelled"
    end
  end

  # ---- Office actions ----

  def assign_to!(new_driver, by: nil)
    step!("This task is already finished") { open? }
    previous = driver
    update!(driver: new_driver, status: status == "unassigned" ? "assigned" : status)
    log!(previous ? "reassigned" : "assigned", by, previous ? "#{previous.name} → #{new_driver.name}" : new_driver.name)
    booking.sync_driver!
  end

  def unassign!(by: nil)
    step!("The driver already has the items – reassign the task to another driver instead") { UNASSIGNABLE.include?(status) }
    previous = driver
    update!(driver: nil, status: "unassigned", started_at: nil, arrived_at: nil)
    log!("unassigned", by, previous&.name)
    booking.sync_driver!
  end

  # Admin correction of a saved proof's details. The original values stay in the audit log.
  def correct_proof!(kind, by:, reason:, **attrs)
    step!("Give a reason for the correction") { reason.to_s.strip.present? }
    proof = proof_of(kind) or raise InvalidStep, "There is no #{kind} record to correct"
    transaction do
      proof.edit_by(by, action: "corrected", reason:) { proof.update!(attrs.slice(:person_name, :occurred_at, :notes, :location)) }
      log!("proof_corrected", by, "#{kind.capitalize}: #{reason}")
    end
  end

  # ---- Driver actions (geo: { latitude:, longitude:, accuracy_m: } when the phone shares it) ----

  def start!(user:, geo: {})
    step!("This task has already been started") { status == "assigned" }
    transaction do
      update!(status: "started", started_at: Time.current)
      booking.transition_to!("out_for_delivery", user:) if delivery? && booking.status != "out_for_delivery"
      log!("started", user, nil, geo)
    end
    send_live_link!(delivery? ? "delivery" : "collection")
  end

  # Emails/texts the customer the live tracking link when the driver sets off towards them.
  def send_live_link!(side)
    driver_first = driver&.name.to_s.split.first.presence || "Your driver"
    purpose = side == "delivery" ? "deliver your items" : "collect your items"
    url = BookingNotifier.tracking_url(booking)
    text = "#{driver_first} is on the way to #{purpose} (#{booking.reference}). Follow them live and see the arrival time: #{url}"
    CustomerMessenger.deliver(
      booking, channels: %w[email sms], email_to: booking["#{side}_email"], phone_to: booking["#{side}_phone"],
      subject: "#{ApplicationMailer::BRAND_NAME}: your driver is on the way – #{booking.reference}", sms_text: "#{ApplicationMailer::BRAND_NAME}: #{text}",
      email: ->(to) { BookingMailer.update_email(to:, subject: "#{ApplicationMailer::BRAND_NAME}: your driver is on the way – #{booking.reference}",
                                                  body: "#{text}\n\n— #{ApplicationMailer::BRAND_FULL}") }
    )
  rescue StandardError => e
    Rails.logger.error("Live link notification failed for #{booking.reference}: #{e.class}: #{e.message}")
  end

  def arrive!(user:, geo: {})
    step!("Start the task before marking arrival") { status == "started" }
    if delivery?
      update!(status: "arrived_delivery", arrived_delivery_at: Time.current)
      log!("arrived_delivery", user, booking.delivery_address, geo)
    else
      update!(status: "arrived", arrived_at: Time.current)
      log!("arrived_collection", user, booking.collection_address, geo)
    end
  end

  # Proof of Collection. Can be corrected until the collection is marked completed.
  def save_collection_proof!(user:, geo: {}, **attrs)
    step!("Mark that you've arrived at the collection location first") { !delivery? && status == "arrived" }
    save_proof!("collection", user:, geo:, location: booking.collection_address, **attrs)
  end

  def complete_collection!(user:, geo: {})
    step!("Mark that you've arrived at the collection location first") { !delivery? && status == "arrived" }
    step!("Upload the collection proof first") { proof_of("collection") }
    transaction do
      update!(status: "collected", collected_at: Time.current)
      # Public tracking shows these notes, so no names here – the POC keeps who handed the items over.
      booking.transition_to!("collected", user:, note: "Items collected", location: booking.collection_city)
      booking.transition_to!("in_transit", user:, note: "On the way to the delivery address") if direct?
      log!("collection_completed", user, nil, geo)
    end
    send_live_link!("delivery") if direct?
  end

  # Collection task: items received and stored at the depot (photos + signature + depot location).
  def save_depot_proof!(user:, geo: {}, **attrs)
    step!("Complete the collection before recording the depot drop-off") { collection? && %w[collected at_depot].include?(status) }
    transaction do
      first_time = proof_of("depot").nil?
      save_proof!("depot", user:, geo:, **attrs)
      if first_time
        update!(status: "at_depot", at_depot_at: Time.current, warehouse_note: attrs[:location].presence || warehouse_note)
        booking.transition_to!("in_warehouse", user:, note: "Items received at our depot")
      end
    end
  end

  # Direct job: after collecting, the driver arrives at the delivery address.
  def arrive_at_delivery!(user:, geo: {})
    step!("Complete the collection first") { direct? && status == "collected" }
    transaction do
      update!(status: "arrived_delivery", arrived_delivery_at: Time.current)
      booking.transition_to!("out_for_delivery", user:) unless booking.status == "out_for_delivery"
      log!("arrived_delivery", user, booking.delivery_address, geo)
    end
  end

  # Proof of Delivery – at least two photos and the recipient's signature. Correctable until delivery is completed.
  def save_delivery_proof!(user:, geo: {}, **attrs)
    step!("Mark that you've arrived at the delivery location first") { at_delivery_location? }
    save_proof!("delivery", user:, geo:, location: booking.delivery_address, **attrs)
  end

  def complete_delivery!(user:, geo: {})
    step!("Upload the proof of delivery (at least 2 photos and a signature) first") { at_delivery_location? && proof_of("delivery") }
    pod = proof_of("delivery")
    transaction do
      update!(status: "delivered", delivered_at: Time.current)
      booking.transition_to!("out_for_delivery", user:) unless booking.status == "out_for_delivery"
      booking.transition_to!("delivered", user:, note: "Delivered to #{pod.person_name}", location: booking.delivery_city)
      log!("delivery_completed", user, nil, geo)
    end
  end

  # Everything that must be done before the task can be closed (empty when it can be closed).
  def missing_for_close
    missing = []
    unless delivery?
      missing << "collection proof" unless proof_of("collection")
      missing << "collection completed" unless collected_at
    end
    if collection?
      missing << "depot drop-off record (photos and signature)" unless proof_of("depot")
    else
      missing << "arrival at the delivery location" unless delivery_arrival_at
      missing << "proof of delivery (2 photos and signature)" unless proof_of("delivery")
      missing << "delivery completed" unless delivered_at
    end
    missing
  end

  def close!(user:, geo: {})
    step!("This task is already closed") { open? }
    missing = missing_for_close
    step!("Before closing, complete: #{missing.to_sentence}") { missing.empty? }
    transaction do
      update!(status: "closed", closed_at: Time.current)
      log!("closed", user, nil, geo)
      if collection? && !booking.driver_tasks.where(kind: "delivery").where.not(status: "cancelled").exists?
        delivery = booking.driver_tasks.create!(kind: "delivery", driver:)
        delivery.events.create!(action: "assigned", note: "#{driver.name} – automatically after the collection was closed", occurred_at: Time.current)
      end
      booking.sync_driver!
    end
  end

  def report_issue!(user:, body:)
    log!("issue_reported", user, body)
  end

  # Driver messages the sender (collection) or recipient (delivery) by email and/or text.
  def message_customer!(user:, side:, channels:, body:)
    step!("Choose who to message") { (side == "collection" && !delivery?) || (side == "delivery" && !collection?) }
    step!("Write a message") { body.to_s.strip.length.between?(2, 500) }
    step!("Choose email or text") { channels.any? && (channels - %w[email sms]).empty? }
    contact = booking["#{side}_contact_name"]
    results = CustomerMessenger.deliver(
      booking, channels:, email_to: booking["#{side}_email"], phone_to: booking["#{side}_phone"],
      subject: "Message from your driver about #{booking.reference}", sms_text: "Shift Logistics (#{booking.reference}): #{body.strip}",
      email: ->(to) { CustomerMailer.driver_message(booking, to:, contact_name: contact, driver_name: user.name, body: body.strip) }
    )
    summary = results.map { |r| "#{r.channel == 'sms' ? 'Text' : 'Email'} to #{r.recipient}: #{r.status.tr('_', ' ')}" }.join(" · ")
    log!("customer_messaged", user, "#{contact} – “#{body.strip.truncate(140)}” (#{summary})")
    results
  end

  # ---- Timing ----

  def timings
    stages =
      case kind
      when "collection"
        [["Travel to collection", started_at, arrived_at], ["Collection duration", arrived_at, collected_at],
         ["Travel to depot", collected_at, at_depot_at], ["At depot until closed", at_depot_at, closed_at]]
      when "delivery"
        [["Travel to delivery", started_at, delivery_arrival_at], ["Delivery duration", delivery_arrival_at, delivered_at || completed_at]]
      else
        [["Travel to collection", started_at, arrived_at], ["Collection duration", arrived_at, collected_at],
         ["Travel to delivery", collected_at, arrived_delivery_at], ["Delivery duration", arrived_delivery_at, delivered_at || completed_at]]
      end
    {
      stages: stages.map { |label, from, to| { label:, seconds: from && to ? [(to - from).round, 0].max : nil, in_progress: from.present? && to.nil? && open? } },
      total_seconds: started_at && finished_at ? [(finished_at - started_at).round, 0].max : nil,
      running_since: (started_at if started_at && !finished_at && open?)
    }
  end

  def as_json(*)
    slice(:id, :kind, :status, :warehouse_note, :scheduled_for, :instructions, :created_at, :started_at, :arrived_at, :collected_at, :at_depot_at,
          :arrived_delivery_at, :delivered_at, :closed_at, :completed_at)
      .merge(status_label:, current_side:, driver: driver&.slice(:id, :name), timings:, missing_for_close: (missing_for_close if open?),
             proofs: proofs.to_h { [_1.kind, _1.as_json] },
             events: events.includes(:user).map(&:as_json))
  end

  private

  def at_delivery_location?
    status == "arrived_delivery" || (delivery? && status == "arrived") # "arrived" = deliveries started before the new workflow
  end

  # Creates the proof, or updates it with every change kept in the audit log.
  def save_proof!(kind, user:, geo:, **attrs)
    attrs = attrs.slice(:person_name, :occurred_at, :notes, :signature_data, :photos, :location).compact
    attrs.delete(:occurred_at) if attrs[:occurred_at].blank?
    record = proof_of(kind)
    attrs[:occurred_at] ||= Time.current unless record # a new proof defaults to now; an edit keeps its recorded time
    transaction do
      if record
        record.edit_by(user, action: "updated") { record.update!(attrs.merge(user:)) }
        log!(kind == "depot" ? "depot_updated" : "#{kind}_proof_updated", user, nil, geo)
      else
        record = proofs.create!(attrs.merge(kind:, user:))
        log!({ "collection" => "collection_proof", "depot" => "depot", "delivery" => "delivery_proof" }[kind], user, record.summary, geo)
        log!("#{kind}_signature", user, "Signed by #{record.person_name}", geo) if record.signature_data.present? && kind != "depot"
      end
    end
    record
  end

  def log!(action, user, note = nil, geo = {})
    geo ||= {}
    events.create!(action:, user:, note:, occurred_at: Time.current,
                   latitude: geo[:latitude], longitude: geo[:longitude], accuracy_m: geo[:accuracy_m])
    record_location!(geo) if geo[:latitude]
  end

  def step!(message)
    raise InvalidStep, message unless yield
  end

  def driver_is_a_driver
    errors.add(:driver, "must be an active driver") unless driver&.role == "driver" && driver.active
  end
end
