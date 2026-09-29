module Api
  module V1
    module Admin
      class DashboardController < BaseController
        def show
          days = params.fetch(:days, 30).to_i.clamp(7, 365)
          since = days.days.ago.beginning_of_day
          bookings = Booking.where(created_at: since..)
          payments = Payment.succeeded.where(created_at: since..)

          daily = bookings.group("date(bookings.created_at)").count
          revenue_daily = payments.group("date(payments.created_at)").sum("amount_pence - refunded_pence")
          series = (since.to_date..Date.current).map do |d|
            { date: d, bookings: daily[d].to_i, revenue_pence: revenue_daily[d].to_i }
          end

          delivered = Booking.where(status: "delivered", delivered_at: since..).where.not(estimated_delivery_date: nil)
          on_time = delivered.where("date(delivered_at) <= estimated_delivery_date").count

          render json: {
            days:,
            totals: {
              bookings: bookings.count,
              revenue_pence: payments.sum("amount_pence - refunded_pence"),
              delivered: delivered.count,
              on_time_rate: delivered.count.zero? ? nil : (on_time * 100.0 / delivered.count).round(1),
              exceptions_open: Booking.where(status: %w[exception failed_delivery]).count,
              quotes_pending: Booking.where(status: "quote_requested").count,
              change_requests_pending: ChangeRequest.pending.count,
              enquiries_open: Enquiry.where(status: %w[open in_progress]).count
            },
            by_status: Booking.group(:status).count,
            by_service: bookings.joins(:service).group("services.name").count,
            series:,
            recent: Booking.includes(:service, :driver).order(created_at: :desc).limit(8).map(&:summary_json)
          }
        end
      end
    end
  end
end
