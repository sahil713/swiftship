# Working-day arithmetic for delivery estimates (Mon–Fri; UK bank holidays not modelled).
module DeliveryCalendar
  module_function

  def add_working_days(date, days)
    date = next_working_day(date) unless working_day?(date)
    days.times { date = next_working_day(date + 1) }
    date
  end

  def working_day?(date) = !date.saturday? && !date.sunday?

  def next_working_day(date)
    date += 1 until working_day?(date)
    date
  end
end
