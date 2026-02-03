"""
Post-process MJML-built booking_confirmation.html to restore Jinja conditionals.

The MJML compiler does not preserve block-level {% if %}...{% endif %} around
sections. This script injects them so that:
- Refund/cancellation emails show "Your Booking" (not "Your Tickets") and no Trip details.
- Confirmation emails show "Your Tickets" and Trip details when present.
"""

from pathlib import Path

# Section comment that MJML outputs before each content block (Your Tickets, Trip details, etc.)
SECTION_COMMENT = (
    '              <!--[if mso | IE]></td></tr></table></td></tr><tr><td class="" '
    'width="600px" ><table align="center" border="0" cellpadding="0" '
    'cellspacing="0" class="" role="presentation" style="width:600px;" '
    'width="600" bgcolor="#ffffff" ><tr><td style="line-height:0px;font-size:0px;'
    'mso-line-height-rule:exactly;"><![endif]-->'
)

# End of a section's wrapper div + start of next section comment
DIVIDER_END_AND_NEXT = "              </div>\n              <!--[if mso | IE]"

# "Your Booking" block (refund/cancellation): same structure as launch_update "Your Booking"
YOUR_BOOKING_BLOCK = """
              <!--[if mso | IE]></td></tr></table></td></tr><tr><td class="" width="600px" ><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:600px;" width="600" bgcolor="#ffffff" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
              <div style="background:#ffffff;background-color:#ffffff;margin:0px auto;max-width:600px;">
                <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;background-color:#ffffff;width:100%;">
                  <tbody>
                    <tr>
                      <td style="direction:ltr;font-size:0px;padding:20px 0;padding-left:24px;padding-right:24px;padding-top:0;text-align:center;">
                        <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:552px;" ><![endif]-->
                        <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                          <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                            <tbody>
                              <tr>
                                <td align="left" style="font-size:0px;padding:10px 25px;padding-bottom:0;word-break:break-word;">
                                  <div style="font-family:Raleway, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:18px;font-weight:bold;line-height:24px;text-align:left;color:#19232d;">Your Booking</div>
                                </td>
                              </tr>
                              <tr>
                                <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                                  <div style="font-family:Raleway, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;font-weight:400;line-height:24px;text-align:left;color:#637381;">Confirmation Code: <strong>{{ confirmation_code }}</strong></div>
                                </td>
                              </tr>
                              <tr>
                                <td align="center" style="font-size:0px;padding:14px 28px;word-break:break-word;">
                                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;line-height:100%;">
                                    <tbody>
                                      <tr>
                                        <td align="center" bgcolor="#fda801" role="presentation" style="border:none;border-radius:4px;cursor:auto;mso-padding-alt:10px 25px;background:#fda801;" valign="middle">
                                          <a href="{{ confirmation_link }}" style="display:inline-block;background:#fda801;color:#19232d;font-family:Raleway, 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;font-weight:bold;line-height:120%;margin:0;text-decoration:none;text-transform:none;padding:10px 25px;mso-padding-alt:0px;border-radius:4px;" target="_blank"> View Your Booking </a>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <!--[if mso | IE]></td></tr></table><![endif]-->
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
"""


def patch(path: Path) -> None:
    content = path.read_text()

    # 1) Insert {% if not is_cancellation and not is_refund %} before the "Your Tickets" section.
    tickets_marker = "Your Tickets</div>"
    pos_tickets = content.find(tickets_marker)
    if pos_tickets == -1:
        raise SystemExit("patch_booking_confirmation: 'Your Tickets</div>' not found")
    section_before_tickets = content.rfind(SECTION_COMMENT, 0, pos_tickets)
    if section_before_tickets == -1:
        raise SystemExit(
            "patch_booking_confirmation: section comment before Your Tickets not found"
        )
    if_content = (
        "              {% if not is_cancellation and not is_refund %}\n              "
    )
    content = (
        content[:section_before_tickets] + if_content + content[section_before_tickets:]
    )

    # 2) After the divider that follows "Your Tickets", insert {% else %} + Your Booking block + {% endif %}.
    pos_trip = content.find("Trip details</div>")
    if pos_trip == -1:
        raise SystemExit("patch_booking_confirmation: 'Trip details</div>' not found")
    # End of divider before Trip details: last "              </div>\n              <!--[if mso" before Trip details
    search_end = content.find("Trip details</div>")
    pos_divider_end = content.rfind(DIVIDER_END_AND_NEXT, 0, search_end)
    if pos_divider_end == -1:
        raise SystemExit(
            "patch_booking_confirmation: divider end before Trip details not found"
        )
    insert_after = pos_divider_end + len("              </div>\n              ")
    else_block = (
        "{% else %}\n"
        + YOUR_BOOKING_BLOCK
        + "              {% endif %}\n              "
    )
    content = content[:insert_after] + else_block + content[insert_after:]

    # 3) Wrap Trip details section (and its following divider) in {% if ... experience_details_html %} ... {% endif %}.
    pos_trip = content.find("Trip details</div>")
    section_before_trip = content.rfind(SECTION_COMMENT, 0, pos_trip)
    if section_before_trip == -1:
        raise SystemExit(
            "patch_booking_confirmation: section comment before Trip details not found"
        )
    trip_if = "              {% if not is_cancellation and not is_refund and experience_details_html %}\n              "
    content = content[:section_before_trip] + trip_if + content[section_before_trip:]

    # Insert {% endif %} after the divider that follows "{{ experience_details_html | safe }}".
    pos_safe = content.find("{{ experience_details_html | safe }}")
    if pos_safe == -1:
        raise SystemExit(
            "patch_booking_confirmation: 'experience_details_html | safe' not found"
        )
    pos_after_trip_divider = content.find(DIVIDER_END_AND_NEXT, pos_safe)
    if pos_after_trip_divider == -1:
        raise SystemExit(
            "patch_booking_confirmation: divider after Trip details not found"
        )
    insert_endif = pos_after_trip_divider + len("              </div>\n              ")
    content = (
        content[:insert_endif] + "{% endif %}\n              " + content[insert_endif:]
    )

    path.write_text(content)


def main() -> None:
    base = Path(__file__).resolve().parent
    html_path = base / "build" / "booking_confirmation.html"
    if not html_path.is_file():
        raise SystemExit(f"patch_booking_confirmation: {html_path} not found")
    patch(html_path)


if __name__ == "__main__":
    main()
