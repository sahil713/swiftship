module Api
  module V1
    module Driver
      # Operations view for drivers: assigned collections and deliveries.
      class JobsController < ApplicationController
        before_action :authenticate!
        before_action -> { require_roles!(:driver, :operations, :admin) }
        before_action :load_job, except: :index

        def index
          scope = jobs_scope.includes(:service).order(:collection_date, :created_at)
          scope = params[:scope] == "completed" ? scope.where(status: %w[delivered cancelled]).limit(50) : scope.where(status: Booking::ACTIVE_JOB_STATUSES)
          render json: scope.map { job_json(_1) }
        end

        def show = render(json: job_json(@job, full: true))

        def status
          new_status = params.require(:status)
          unless Booking::DRIVER_STATUSES.include?(new_status)
            return render json: { error: "Drivers can't set that status" }, status: :unprocessable_entity
          end
          if new_status == "delivered" && @job.proof_of_delivery.nil?
            return render json: { error: "Record proof of delivery first" }, status: :unprocessable_entity
          end
          if %w[exception failed_delivery].include?(new_status) && params[:note].blank?
            return render json: { error: "Add a note describing what happened" }, status: :unprocessable_entity
          end
          @job.transition_to!(new_status, user: current_user, note: params[:note].presence, location: params[:location].presence)
          render json: job_json(@job.reload, full: true)
        end

        def proof_of_delivery
          unless @job.status == "out_for_delivery"
            return render json: { error: "Proof of delivery can be recorded once the job is out for delivery" }, status: :unprocessable_entity
          end
          pod = @job.proof_of_delivery || @job.build_proof_of_delivery
          pod.assign_attributes(params.permit(:recipient_name, :signature_data, :photo_data, :notes).merge(user: current_user))
          Booking.transaction do
            pod.save!
            @job.transition_to!("delivered", user: current_user, note: "Signed for by #{pod.recipient_name}", location: params[:location].presence)
          end
          render json: job_json(@job.reload, full: true)
        end

        def report_issue
          kind = params.fetch(:kind, "delivery_issue")
          return render(json: { error: "Invalid issue type" }, status: :unprocessable_entity) unless BookingNote::KINDS.include?(kind)
          @job.notes.create!(user: current_user, kind:, body: params.require(:body))
          if params[:mark_exception].to_s == "true" && @job.can_transition_to?("exception")
            @job.transition_to!("exception", user: current_user, note: params[:customer_note].presence || "We've recorded an issue with your shipment.")
          end
          render json: job_json(@job.reload, full: true)
        end

        private

        def jobs_scope
          current_user.driver? ? current_user.assigned_bookings : Booking.where.not(driver_id: nil)
        end

        def load_job = @job = jobs_scope.find_by!(reference: params[:reference])

        def job_json(job, full: false)
          data = job.summary_json.merge(
            job.attributes.slice(*%w[
              collection_contact_name collection_phone collection_line1 collection_line2
              delivery_contact_name delivery_phone delivery_line1 delivery_line2
              collection_instructions delivery_instructions fragile weight_kg
            ]),
            stage: %w[booked].include?(job.status) ? "collection" : "delivery",
            allowed_statuses: Booking::TRANSITIONS.fetch(job.status, []) & Booking::DRIVER_STATUSES
          )
          if full
            data[:events] = job.status_events.includes(:user).map(&:as_json)
            data[:notes] = job.notes.includes(:user).map(&:as_json)
            data[:proof_of_delivery] = job.proof_of_delivery&.as_json
          end
          data
        end
      end
    end
  end
end
