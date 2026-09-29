# Format validation and parsing for UK postcodes.
module UkPostcode
  PATTERN = /\A([A-Z]{1,2}[0-9][A-Z0-9]?) ?([0-9][A-Z]{2})\z/
  # Irish Eircodes, e.g. "D02 X285" or "A65 F4E2" – Ireland is outside the service area.
  EIRCODE = /\A(?:[AC-FHKNPRTV-Y][0-9]{2}|D6W) ?[0-9AC-FHKNPRTV-Y]{4}\z/

  module_function

  def normalize(raw) = raw.to_s.upcase.gsub(/[^A-Z0-9]/, "")

  def valid?(raw) = PATTERN.match?(normalize(raw))

  def format(raw)
    m = PATTERN.match(normalize(raw))
    m && "#{m[1]} #{m[2]}"
  end

  def outward(raw) = format(raw)&.split&.first

  # Postcode area: the leading letters, e.g. "SW" for "SW1A 1AA", "B" for "B1 1AA".
  def area(raw) = format(raw)&.[](/\A[A-Z]+/)

  def eircode?(raw) = EIRCODE.match?(normalize(raw))
end
