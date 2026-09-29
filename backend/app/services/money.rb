module Money
  module_function

  def format(pence) = pence.nil? ? nil : "£#{'%.2f' % (pence / 100.0)}"
end
