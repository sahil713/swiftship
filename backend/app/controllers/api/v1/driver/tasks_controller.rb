module Api
  module V1
    module Driver
      # The driver portal: a driver sees and works only on the tasks assigned to them.
      # Operations staff and admins can view and act on every task.
      class TasksController < ApplicationController
        before_action :authenticate!
        before_action -> { require_roles!(:driver, :operations, :admin) }
        before_action :load_task, except: :index

        rescue_from DriverTask::InvalidStep, with: ->(e) { render json: { error: e.message }, status: :unprocessable_entity }

        def index
          scope = tasks_scope.includes(:driver, :proof, booking: :service).order(:created_at)
          scope = params[:scope] == "completed" ? scope.finished.reorder(updated_at: :desc).limit(50) : scope.open
          render json: scope.map { task_json(_1) }
        end

        def show = render_task

        # Proof of Collection: who handed the items over, when, photos, notes and optional signature.
        def collect
          @task.record_collection!(user: current_user, **proof_params)
          render_task
        end

        def close
          @task.close_at_warehouse!(user: current_user, note: params[:note])
          render_task
        end

        def start
          @task.start_delivery!(user: current_user)
          render_task
        end

        # Proof of Delivery: recipient name, date/time, notes, photos and customer signature.
        def proof
          @task.record_delivery_proof!(user: current_user, **proof_params)
          render_task
        end

        def complete
          @task.complete_delivery!(user: current_user)
          render_task
        end

        def report_issue
          kind = params.fetch(:kind, @task.collection? ? "collection_issue" : "delivery_issue")
          return render(json: { error: "Invalid issue type" }, status: :unprocessable_entity) unless BookingNote::KINDS.include?(kind)

          booking = @task.booking
          booking.notes.create!(user: current_user, kind:, body: params.require(:body))
          if params[:mark_exception].to_s == "true" && booking.can_transition_to?("exception")
            booking.transition_to!("exception", user: current_user, note: params[:customer_note].presence || "We've recorded an issue with your shipment.")
          end
          render_task
        end

        private

        def tasks_scope = current_user.driver? ? DriverTask.where(driver: current_user) : DriverTask.all

        def load_task = @task = tasks_scope.find(params[:id])

        def proof_params
          attrs = params.permit(:person_name, :occurred_at, :notes, :signature_data, photos: []).to_h.symbolize_keys
          attrs[:occurred_at] = attrs[:occurred_at].presence || Time.current
          attrs[:photos] ||= []
          attrs
        end

        def render_task = render(json: task_json(@task.reload, full: true))

        # Only what the driver needs for this leg of the job.
        def task_json(task, full: false)
          b = task.booking
          side = task.collection? ? "collection" : "delivery"
          data = task.as_json.merge(
            reference: b.reference, tracking_number: b.tracking_number, booking_status: b.status,
            service: b.service.name, date: task.collection? ? b.collection_date : b.estimated_delivery_date,
            contact_name: b["#{side}_contact_name"], contact_phone: b["#{side}_phone"], contact_email: b["#{side}_email"],
            address: { line1: b["#{side}_line1"], line2: b["#{side}_line2"], city: b["#{side}_city"], postcode: b["#{side}_postcode"] },
            instructions: b["#{side}_instructions"], special_requirements: b.special_requirements,
            item: { description: b.item_description, quantity: b.quantity, weight_kg: b.weight_kg&.to_f,
                    length_cm: b.length_cm&.to_f, width_cm: b.width_cm&.to_f, height_cm: b.height_cm&.to_f, fragile: b.fragile }
          )
          data[:customer_email] = b.customer_email if task.collection?
          # Lists only need to know a proof exists – images are sent with the single task.
          if !full && data[:proof]
            data[:proof] = data[:proof].except("signature_data", "photos").merge("photo_count" => task.proof.photos.size)
          end
          data
        end
      end
    end
  end
end
