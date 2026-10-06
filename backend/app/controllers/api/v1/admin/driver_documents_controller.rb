module Api
  module V1
    module Admin
      # Private driver documents. Admin-only: operations staff can't list, upload or open them.
      class DriverDocumentsController < BaseController
        before_action :admin_only!
        before_action :load_driver

        def index
          docs = @driver.driver_documents.without_data.includes(:uploaded_by, :replaced_by).order(created_at: :desc)
          render json: docs
        end

        # Uploads a document. A newer upload of the same type replaces the current one, which is kept as history.
        def create
          file = params.require(:file)
          return render(json: { error: "Choose a file to upload" }, status: :unprocessable_entity) unless file.respond_to?(:read)
          if file.size > DriverDocument::MAX_BYTES
            return render json: { error: "Files must be 4 MB or smaller" }, status: :unprocessable_entity
          end

          doc = DriverDocument.from_upload(file, user: @driver, uploaded_by: current_user, doc_type: params[:doc_type],
                                                 expires_on: params[:expires_on].presence, notes: params[:notes].presence)
          DriverDocument.transaction do
            previous = @driver.driver_documents.current.where(doc_type: doc.doc_type).where.not(id: nil).to_a
            doc.save!
            previous.each { _1.update_columns(replaced_at: Time.current, replaced_by_id: current_user.id) }
            AuditLog.record!(@driver, user: current_user, action: previous.any? ? "document_replaced" : "document_uploaded",
                             changes: { DriverDocument::TYPES[doc.doc_type] => [previous.first&.filename, doc.filename] })
          end
          render json: DriverDocument.without_data.find(doc.id), status: :created
        end

        # Sends the file to the signed-in admin only; never cached or publicly linked.
        def file
          doc = @driver.driver_documents.find(params[:id])
          response.headers["Cache-Control"] = "private, no-store"
          response.headers["X-Content-Type-Options"] = "nosniff"
          send_data doc.data, filename: doc.filename, type: doc.content_type, disposition: params[:download] ? "attachment" : "inline"
        end

        # Removes a document from the profile but keeps it in the history (with who removed it).
        def destroy
          doc = @driver.driver_documents.current.find(params[:id])
          doc.update_columns(replaced_at: Time.current, replaced_by_id: current_user.id)
          AuditLog.record!(@driver, user: current_user, action: "document_removed", changes: { DriverDocument::TYPES[doc.doc_type] => [doc.filename, nil] }, reason: params[:reason])
          head :no_content
        end

        private

        def load_driver = @driver = User.where(role: "driver").find(params[:driver_id])
      end
    end
  end
end
