require "test_helper"

class DriverManagementTest < ActionDispatch::IntegrationTest
  PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==".freeze

  setup do
    Rails.application.load_seed
    @admin = auth_headers("admin@swiftship.example")
  end

  def create_driver(attrs = {})
    post "/api/v1/admin/drivers", params: { driver: { first_name: "Nina", last_name: "Driver", phone: "07700 900888", username: "nina", password: "drive-safe-1",
                                                       licence_number: "DRIVE123456AB9CD", transmission: "automatic" }.merge(attrs) }, headers: @admin, as: :json
    json
  end

  def booked_job
    booking = Booking.find_by!(status: "quote_requested")
    post "/api/v1/admin/bookings/#{booking.reference}/status", params: { status: "booked" }, headers: @admin, as: :json
    booking
  end

  test "admin creates a driver who signs in with a username and sees only their tasks" do
    driver = create_driver
    assert_response :created
    assert_equal "nina", driver["username"]
    assert_nil driver["email"]

    post "/api/v1/auth/login", params: { email: "NINA", password: "drive-safe-1" }, as: :json
    assert_response :success
    nina = { "Authorization" => "Bearer #{json['token']}" }
    assert_equal "driver", json.dig("user", "role")

    job = booked_job
    post "/api/v1/admin/bookings/#{job.reference}/assign_task", params: { kind: "collection", driver_id: driver["id"] }, headers: @admin, as: :json
    task_id = json.dig("booking", "tasks").first["id"]

    get "/api/v1/driver/tasks", headers: nina
    assert_equal [task_id], json.map { _1["id"] }
    get "/api/v1/driver/tasks", headers: auth_headers("driver@swiftship.example")
    refute_includes json.map { _1["id"] }, task_id
  end

  test "operations staff can view drivers but not create them" do
    ops = auth_headers("ops@swiftship.example")
    get "/api/v1/admin/drivers", headers: ops
    assert_response :success
    post "/api/v1/admin/drivers", params: { driver: { name: "X", username: "xx1", password: "password99" } }, headers: ops, as: :json
    assert_response :forbidden
    get "/api/v1/admin/drivers", headers: auth_headers("driver@swiftship.example")
    assert_response :forbidden
  end

  test "admin edits details and resets the password" do
    driver = create_driver
    patch "/api/v1/admin/drivers/#{driver['id']}", params: { driver: { last_name: "Dawson", phone: "07700 111222", email: "nina@example.com", password: "brand-new-pass" } }, headers: @admin, as: :json
    assert_response :success
    assert_equal "Nina Dawson", json["name"]

    post "/api/v1/auth/login", params: { email: "nina", password: "drive-safe-1" }, as: :json
    assert_response :unauthorized, "old password no longer works"
    post "/api/v1/auth/login", params: { email: "nina@example.com", password: "brand-new-pass" }, as: :json
    assert_response :success
  end

  test "deactivating a driver blocks sign-in and unassigns their open tasks" do
    driver = create_driver
    job = booked_job
    post "/api/v1/admin/bookings/#{job.reference}/assign_task", params: { kind: "collection", driver_id: driver["id"] }, headers: @admin, as: :json

    patch "/api/v1/admin/drivers/#{driver['id']}", params: { driver: { active: false } }, headers: @admin, as: :json
    assert_response :success
    assert_equal 1, json["unassigned_tasks"]
    assert_equal "unassigned", job.reload.collection_task.status

    post "/api/v1/auth/login", params: { email: "nina", password: "drive-safe-1" }, as: :json
    assert_response :unauthorized

    get "/api/v1/admin/drivers", params: { status: "inactive" }, headers: @admin
    assert_includes json.map { _1["id"] }, driver["id"]
  end

  test "a driver holding collected items can't be deactivated until the task is reassigned" do
    driver = create_driver
    job = booked_job
    post "/api/v1/admin/bookings/#{job.reference}/assign_task", params: { kind: "collection", driver_id: driver["id"] }, headers: @admin, as: :json
    nina = User.find(driver["id"])
    task = job.reload.collection_task
    task.start!(user: nina)
    task.arrive!(user: nina)
    task.record_collection!(user: nina, person_name: "Sender", occurred_at: Time.current, photos: [PHOTO])

    patch "/api/v1/admin/drivers/#{driver['id']}", params: { driver: { active: false } }, headers: @admin, as: :json
    assert_response :unprocessable_entity
    assert_match(/Reassign/, json["error"])

    dan = User.find_by!(email: "driver@swiftship.example")
    post "/api/v1/admin/tasks/#{job.collection_task.id}/assign", params: { driver_id: dan.id }, headers: @admin, as: :json
    assert_response :success
    patch "/api/v1/admin/drivers/#{driver['id']}", params: { driver: { active: false } }, headers: @admin, as: :json
    assert_response :success
  end

  test "drivers without task history can be removed; others must be deactivated" do
    fresh = create_driver(username: "fresh1")
    delete "/api/v1/admin/drivers/#{fresh['id']}", headers: @admin
    assert_response :no_content

    dan = User.find_by!(email: "driver@swiftship.example")
    delete "/api/v1/admin/drivers/#{dan.id}", headers: @admin
    assert_response :unprocessable_entity
    assert_match(/Deactivate/, json["error"])
  end

  test "admin assigns, reassigns and unassigns tasks and sees each status" do
    job = booked_job
    dan = User.find_by!(email: "driver@swiftship.example")
    priya = User.find_by!(email: "driver2@swiftship.example")
    post "/api/v1/admin/bookings/#{job.reference}/assign_task", params: { kind: "collection", driver_id: dan.id }, headers: @admin, as: :json
    task = job.reload.collection_task

    post "/api/v1/admin/tasks/#{task.id}/assign", params: { driver_id: priya.id }, headers: @admin, as: :json
    assert_equal "Priya Patel", json.dig("driver", "name")
    assert_equal "Assigned", json["status_label"]

    post "/api/v1/admin/tasks/#{task.id}/unassign", headers: @admin, as: :json
    assert_equal "Unassigned", json["status_label"]
    assert_nil json["driver"]
    get "/api/v1/driver/tasks", headers: auth_headers(priya.email)
    refute_includes json.map { _1["id"] }, task.id, "an unassigned task disappears from the driver's list"

    get "/api/v1/admin/tasks", params: { driver_id: "none" }, headers: @admin
    assert_includes json["tasks"].map { _1["id"] }, task.id

    post "/api/v1/admin/tasks/#{task.id}/assign", params: { driver_id: dan.id }, headers: @admin, as: :json
    dan_headers = auth_headers(dan.email)
    post "/api/v1/driver/tasks/#{task.id}/start", headers: dan_headers, as: :json
    assert_equal "In Progress", json["status_label"]
    post "/api/v1/driver/tasks/#{task.id}/arrive", headers: dan_headers, as: :json
    post "/api/v1/driver/tasks/#{task.id}/collect", params: { person_name: "Sender", photos: [PHOTO] }, headers: dan_headers, as: :json
    assert_equal "Collected", json["status_label"]
    post "/api/v1/admin/tasks/#{task.id}/unassign", headers: @admin, as: :json
    assert_response :unprocessable_entity, "can't unassign once the driver has the items"
    post "/api/v1/driver/tasks/#{task.id}/close", params: { person_name: "Depot", photos: [PHOTO], signature_data: "data:image/png;base64,iVBORw0KGgo=" }, headers: dan_headers, as: :json
    assert_equal "At Depot", json["status_label"]

    delivery = job.reload.delivery_task
    post "/api/v1/driver/tasks/#{delivery.id}/start", headers: dan_headers, as: :json
    assert_equal "Out for Delivery", json["status_label"]
    post "/api/v1/driver/tasks/#{delivery.id}/arrive", headers: dan_headers, as: :json
    post "/api/v1/driver/tasks/#{delivery.id}/proof", params: { person_name: "Recv", photos: [PHOTO, PHOTO], signature_data: "data:image/png;base64,iVBORw0KGgo=" }, headers: dan_headers, as: :json
    post "/api/v1/driver/tasks/#{delivery.id}/complete", headers: dan_headers, as: :json
    assert_equal "Completed", json["status_label"]

    get "/api/v1/admin/drivers/#{dan.id}", headers: @admin
    statuses = json["tasks"].select { _1["reference"] == job.reference }.map { _1["status_label"] }
    assert_equal ["Completed", "At Depot"], statuses
  end

  test "driver profile: required details, encrypted sensitive fields, admin-only visibility" do
    post "/api/v1/admin/drivers", params: { driver: { first_name: "No", last_name: "Licence", phone: "07700 900111", username: "nolicence", password: "password99" } }, headers: @admin, as: :json
    assert_response :unprocessable_entity
    assert_match(/Licence number|Transmission/i, json["error"])

    driver = create_driver(username: "full1", passport_number: "123456789", visa_status: "Skilled Worker visa", visa_expiry: "2027-05-31",
                           bank_account_name: "Nina Driver", bank_sort_code: "12-34-56", bank_account_number: "12345678")
    assert_response :created
    assert_equal "Nina Driver", driver["name"]
    assert_equal "automatic", driver["transmission"]
    assert_equal "12345678", driver["bank_account_number"]

    raw = User.connection.select_one("SELECT licence_number, bank_account_number, passport_number FROM users WHERE id = #{driver['id']}")
    refute_includes raw.values.join, "12345678", "bank account number must be encrypted at rest"
    refute_includes raw.values.join, "DRIVE123456AB9CD", "licence number must be encrypted at rest"

    get "/api/v1/admin/drivers/#{driver['id']}", headers: auth_headers("ops@swiftship.example")
    refute json["driver"].key?("bank_account_number"), "operations staff don't see bank details"
    refute json["driver"].key?("passport_number")

    post "/api/v1/admin/drivers", params: { driver: { first_name: "Bad", last_name: "Bank", phone: "07700 900111", username: "badbank", password: "password99",
                                                       licence_number: "X1", transmission: "manual", bank_sort_code: "12345" } }, headers: @admin, as: :json
    assert_response :unprocessable_entity
    assert_match(/sort code/i, json["error"])
  end
end
