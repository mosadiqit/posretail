# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
import logging
from odoo.exceptions import UserError
import json

try:
    to_unicode = unicode
except NameError:
    to_unicode = str

_logger = logging.getLogger(__name__)


class pos_config_image(models.Model):
    _name = "pos.config.image"
    _description = "Image show to customer screen"

    name = fields.Char('Title', required=1)
    image = fields.Binary('Image', required=1)
    config_id = fields.Many2one('pos.config', 'POS config', required=1)
    description = fields.Text('Description')


class pos_config(models.Model):
    _inherit = "pos.config"

    @api.model_cr
    def init(self):
        self.env.cr.execute("""DELETE FROM ir_model_data WHERE model IN ('pos.bus', 'pos.bus.log', 'pos.tracking.client')""");

    def set_pricelists_to_pos_sessions_online_without_reload(self):
        for config in self:
            if config.pricelist_id:
                config.pricelist_id.sync_pricelists_all_pos_online()
                break
            else:
                raise UserError('Please active pricelist and set pricelist default')
        return True

    user_id = fields.Many2one('res.users', 'Assigned to')
    config_access_right = fields.Boolean('Config Access Right', default=1)
    allow_discount = fields.Boolean('Allow Change Discount', default=1)
    allow_qty = fields.Boolean('Allow Change Quantity', default=1)
    allow_price = fields.Boolean('Allow Change Price', default=1)
    allow_remove_line = fields.Boolean('Allow Remove Line', default=1)
    allow_numpad = fields.Boolean('Allow Use Numpad', default=1)
    allow_payment = fields.Boolean('Allow Payment', default=1)
    allow_customer = fields.Boolean('Allow set Customer', default=1)
    allow_add_order = fields.Boolean('Allow Add Order', default=1)
    allow_remove_order = fields.Boolean('Allow Remove Order', default=1)
    allow_add_product = fields.Boolean('Allow Add Product', default=1)

    allow_lock_screen = fields.Boolean('Lock Screen when Session Start',
                                       default=0,
                                       help='When pos sessions start, \n'
                                            'cashiers required open POS via pos pass pin (Setting/Users)')
    lock_state = fields.Selection([
        ('unlock', 'Un lock'),
        ('locked', 'Locked')
    ], default='unlock', string='Lock state', help='Unlock: when pos session start, pos not lock screen\n'
                                                   'locked: when pos session start, pos auto lock screen')

    display_point_receipt = fields.Boolean('Display Point / Receipt', help='Active this field for display loyalty\n'
                                                                           ' point plus on bill receipt')
    loyalty_id = fields.Many2one('pos.loyalty', 'Loyalty',
                                 domain=[('state', '=', 'running')])

    promotion_manual_select = fields.Boolean('Promotion manual choose', default=0,
                                             help='When you check to this checkbox, \n'
                                                  'your cashiers will have one button, \n'
                                                  'when cashiers clicked on it, \n'
                                                  'all promotions active will display for choose')
    promotion_auto_add = fields.Boolean('Promotion auto', help='When you check it,\n'
                                                               ' when your cashiers click payment button,\n'
                                                               ' all promotions active auto add to order cart')

    create_purchase_order = fields.Boolean('Create PO', default=0)
    create_purchase_order_required_signature = fields.Boolean('PO Required Signature', default=0)
    purchase_order_state = fields.Selection([
        ('confirm_order', 'Auto Confirm'),
        ('confirm_picking', 'Auto Delivery'),
        ('confirm_invoice', 'Auto Invoice'),
    ], 'PO state',
        help='This is state of purchase order will process to',
        default='confirm_invoice')
    sale_order = fields.Boolean('Create Sale Order', default=0)
    sale_order_auto_confirm = fields.Boolean('Auto Confirm', default=0)
    sale_order_auto_invoice = fields.Boolean('Auto Paid', default=0)
    sale_order_auto_delivery = fields.Boolean('Auto Delivery', default=0)
    sale_order_print_receipt = fields.Boolean('Print Receipt', help='Allow print receipt when create quotation/order')
    sale_order_required_signature = fields.Boolean('SO Required Signature',
                                                   help='Allow print receipt when create quotation/order')

    pos_orders_management = fields.Boolean('POS Order Management', default=0)
    pos_orders_load_all = fields.Boolean(
        'Load all Orders',
        help='If checked: each pos session will load all orders of system to POS Session \n'
             'If uncheck: each pos session will load only orders created from self Config Session')
    hide_buttons_order_return = fields.Boolean('Hide Buttons if Order Return', default=0,
                                               help='Hide All Buttons when Order is return mode')
    pos_orders_filter_by_branch = fields.Boolean('POS Order Filter Branch', default=0,
                                                 help='If you checked it, \n'
                                                      'POS session could not see orders of another branch')
    pos_order_period_return_days = fields.Float('Return period days',
                                                help='this is period time for customer can return order',
                                                default=30)
    display_return_days_receipt = fields.Boolean('Display Return Days on Receipt', default=0)
    display_onhand = fields.Boolean('Show qty available product', default=1,
                                    help='Display quantity on hand all products on pos screen')
    allow_order_out_of_stock = fields.Boolean('Allow out-of-stock', default=1,
                                              help='If checked, allow cashier can add product have out of stock')
    print_voucher = fields.Boolean('Create/Print voucher', help='Allow cashiers create voucher on POS', default=0)
    expired_days_voucher = fields.Integer('Expired days of voucher', default=30,
                                          help='Total days keep voucher can use, \n'
                                               'if out of period days from create date, voucher will expired')

    sync_multi_session = fields.Boolean('Sync Between Session', default=0)
    sync_multi_session_offline = fields.Boolean('Sync Between Session Offline', default=0)
    sync_multi_session_offline_iot_ids = fields.Many2many('pos.iot', 'pos_config_iot_rel', 'pos_config_id',
                                                          'iot_box_id', string='IoT Boxes',
                                                          help='IoT box use for sync between sessions \n'
                                                               'when Odoo Server Offline or your internet disconected')
    sync_manual_button = fields.Boolean(
        'Sync Manual Button',
        help='If active, pos session will have button Sync Selected \n'
             'When click it, order selected will sync another pos configs added above\n'
             'Order selected will replace another order of another session the same uid')
    sync_to_pos_config_ids = fields.Many2many(
        'pos.config',
        'sync_session_rel',
        'from_id',
        'to_id',
        domain="['|', ('pos_branch_id', '=', pos_branch_id), ('pos_branch_id', '=', None)]",
        string='Sync with POS Locations',
        help='Events changes from this POS Location will sync direct \n' \
             'to this pos locations selected here'
    )
    display_person_add_line = fields.Boolean('Display information line', default=0,
                                             help="When you checked, on pos order lines screen, \n"
                                                  "will display information person created order \n"
                                                  "(lines) Eg: create date, updated date ..")
    internal_transfer = fields.Boolean('Internal transfer', default=0,
                                       help='Go Inventory and active multi warehouse and location')
    internal_transfer_auto_validate = fields.Boolean('Internal transfer auto validate', default=0)

    discount = fields.Boolean('Global Discount (%)', default=0)
    discount_ids = fields.Many2many('pos.global.discount',
                                    'pos_config_pos_global_discount_rel',
                                    'config_id',
                                    'discount_id',
                                    'Global discounts')
    is_customer_screen = fields.Boolean('Is customer screen')
    delay = fields.Integer('Delay time', default=3000)
    slogan = fields.Char('Slogan', help='This is message will display on screen of customer')
    image_ids = fields.One2many('pos.config.image', 'config_id', 'Images')

    tooltip = fields.Boolean('Show information of product', default=0)
    tooltip_show_last_price = fields.Boolean('Show last price of product',
                                             help='Show last price of items of customer have bought before',
                                             default=0)
    tooltip_show_minimum_sale_price = fields.Boolean('Show min of product sale price',
                                                     help='Show minimum sale price of product',
                                                     default=0)
    discount_limit = fields.Boolean('Discount limit', default=0)
    discount_limit_amount = fields.Float('Discount limit (%)', default=10)
    discount_each_line = fields.Boolean('Discount each line')
    discount_sale_price = fields.Boolean('Discount Sale Price')
    discount_sale_price_limit = fields.Float('Discount Sale Price Limit',
                                             help='Cashier could not set discount price bigger than or equal this field')

    return_products = fields.Boolean('Return products',
                                     help='Allow cashier return products, orders',
                                     default=0)
    receipt_without_payment_template = fields.Selection([
        ('none', 'None'),
        ('display_price', 'Show Price'),
        ('not_display_price', 'Not Show Price')
    ], default='not_display_price', string='Review Receipt Template',
        help='Review/Print Receipt Order before pay\n'
             'This function only supported posbox and printer\n'
             'Not support web print')
    lock_order_printed_receipt = fields.Boolean('Lock Order Printed Receipt', default=0)
    staff_level = fields.Selection([
        ('manual', 'Manual config'),
        ('marketing', 'Marketing'),
        ('waiter', 'Waiter'),
        ('cashier', 'Cashier'),
        ('manager', 'Manager')
    ], string='Staff level', default='manual')

    validate_payment = fields.Boolean('Validate payment')
    validate_remove_order = fields.Boolean('Validate remove order')
    validate_change_minus = fields.Boolean('Validate pressed +/-')
    validate_quantity_change = fields.Boolean('Validate quantity change')
    validate_price_change = fields.Boolean('Validate price change')
    validate_discount_change = fields.Boolean('Validate discount change')
    validate_close_session = fields.Boolean('Validate close session')
    apply_validate_return_mode = fields.Boolean('Validate return mode',
                                                help='If checked, only applied validate when return order', default=1)

    print_user_card = fields.Boolean('Print User Card')

    product_operation = fields.Boolean(
        'Product Operation', default=0,
        help='Allow cashiers add pos categories and products on pos screen')
    quickly_payment_full = fields.Boolean('Quickly Paid Full')
    quickly_payment_full_journal_id = fields.Many2one(
        'account.journal', 'Payment Mode',
        domain=[('journal_user', '=', True),
                ('pos_method_type', '=', 'default')])
    note_order = fields.Boolean('Note Order', default=0)
    note_orderline = fields.Boolean('Note Order Line', default=0)
    signature_order = fields.Boolean('Signature Order', default=0)
    display_amount_discount = fields.Boolean('Display Amount Discount', default=0)

    booking_orders = fields.Boolean(
        'Booking Orders',
        default=0,
        help='Orders may be come from many sources locations\n'
             'Example: Web E-Commerce, Call center, or phone call order\n'
             'And your Cashiers will made Booking Orders and save it\n'
             'Your Shipper or customer come shop will delivery Orders')
    booking_orders_required_cashier_signature = fields.Boolean(
        'Required Signature',
        help='When your cashiers create Book Order\n'
             'Will require your cashier signature on order',
        default=0)
    booking_orders_alert = fields.Boolean(
        'Alert Order Coming', default=0,
        help='When have any Booking Order come from another Source Location to POS\n'
             'POS will Alert one popup inform your cashier have new Order coming')
    booking_allow_confirm_sale = fields.Boolean(
        'Allow Confirm Sale',
        help='Display Button Confirm Sale',
        default=1)
    delivery_orders = fields.Boolean(
        'Delivery Order',
        help='Finish Order and Give Receipt to your Shipper delivery Order',
        default=0)
    booking_orders_display_shipping_receipt = fields.Boolean('Shipping Address Receipt', default=0)
    display_tax_orderline = fields.Boolean('Display Taxes Order Line', default=0)
    display_tax_receipt = fields.Boolean('Display Taxes Receipt', default=0)
    display_fiscal_position_receipt = fields.Boolean('Display Fiscal Position on Receipt', default=0)

    display_image_orderline = fields.Boolean('Display Image on Order Lines', default=0)
    display_image_receipt = fields.Boolean('Display Image on Receipt', default=0)
    duplicate_receipt = fields.Boolean('Duplicate Receipt', help='If you need print bigger than 1 receipt / 1 order,\n'
                                                                 ' add bigger than 1')
    print_number = fields.Integer('Print number', help='How many Bill need print on one Order', default=0)
    category_wise_receipt = fields.Boolean('Category Wise Receipt', default=0, help='Bill will wise each POS Category')
    management_invoice = fields.Boolean('Display Invoices Screen', default=0)
    load_invoice_paid = fields.Boolean('Load Invoice Paid', default=0,
                                       help='If checked, all invoice state is paid will load to pos session')
    invoice_offline = fields.Boolean('Invoice Offline',
                                     help='Default POS Original Odoo when active Invoice,\n'
                                          'Cashiers will need waiting few seconds for create Invoice from Backend\n'
                                          'If you check to box active, passing waiting time, \n'
                                          'invoice will create few seconds later\n'
                                          'And so Your Cashiers push Orders to backend faster than few seconds')
    wallet = fields.Boolean('Wallet Card',
                            help='Keeping all change money back to Customer Wallet Card\n'
                                 'Example: customer bought products with total amount is 9.5 USD\n'
                                 'Customer give your Cashier 10 USD, \n'
                                 'Default your cashier will return back change money 0.5 USD\n'
                                 'But Customer no want keep it, \n'
                                 'They need change money including to Wallet Card for next order\n'
                                 'Next Time customer come back, \n'
                                 'When your cashier choice client have Wallet Credit Amount bigger than 0\n'
                                 'Customer will have one more payment method viva Wallet Credit')
    invoice_journal_ids = fields.Many2many(
        'account.journal',
        'pos_config_invoice_journal_rel',
        'config_id',
        'journal_id',
        'Accounting Invoice Journal',
        domain=[('type', '=', 'sale')],
        help="Default POS Odoo save Invoice Journal from only one Invoicing Journal of POS Config\n"
             "This future allow you add many Journals here\n"
             "And when your cashier choice Journal on POS\n"
             "Invoice create from order will the same Journal selected by cashier")
    send_invoice_email = fields.Boolean('Send email invoice', help='Help cashier send invoice to email of customer',
                                        default=0)
    lock_print_invoice_on_pos = fields.Boolean('Lock print invoice',
                                               help='Lock print pdf invoice when clicked button invoice', default=0)
    pos_auto_invoice = fields.Boolean('Auto create invoice',
                                      help='Automatic create invoice if order have client',
                                      default=0)
    receipt_invoice_number = fields.Boolean('Add invoice on receipt', help='Show invoice number on receipt header',
                                            default=0)
    receipt_customer_vat = fields.Boolean('Add vat customer on receipt',
                                          help='Show customer VAT(TIN) on receipt header', default=0)
    receipt_wrapped_product_name = fields.Boolean('Receipt Wrapped Product Name', default=1)
    receipt_header_style = fields.Selection([
        ('left', 'Left'),
        ('center', 'Center'),
        ('right', 'Right')
    ],
        default='left',
        string='Header Receipt Style',
        help='Header style, this future only apply on posbox and printer connected\n'
             'Not apply for printer direct web browse'
    )
    auto_register_payment = fields.Boolean('Auto invocie register payment', default=0)

    fiscal_position_auto_detect = fields.Boolean('Fiscal position auto detect', default=0)

    display_sale_price_within_tax = fields.Boolean('Display sale price within tax', default=0)
    display_cost_price = fields.Boolean('Display product cost price', default=0)
    display_product_ref = fields.Boolean('Display product ref', default=0)
    hide_product_image = fields.Boolean('Hide product image', default=0)
    multi_location = fields.Boolean('Multi location', default=0)
    product_view = fields.Selection([
        ('box', 'Box view'),
        ('list', 'List view'),
    ], default='box', string='View of products screen', required=1)
    product_image_size = fields.Selection([
        ('default', 'Default'),
        ('small', 'Small'),
        ('big', 'Big')
    ],
        default='big',
        string='Product Image Size')
    ticket_font_size = fields.Integer('Bill Font Size', default=12,
                                      help='Font Size of Bill print viva Web, not support posbox')
    customer_default_id = fields.Many2one('res.partner', 'Customer default')
    medical_insurance = fields.Boolean('Medical insurance', default=0)
    set_guest = fields.Boolean('Set guest', default=0)
    set_guest_when_add_new_order = fields.Boolean('Ask guests', help='Ask how many guests when create new order')
    reset_sequence = fields.Boolean('Reset sequence order', default=0)
    update_tax = fields.Boolean('Modify tax', default=0, help='Cashier can change tax of order line')
    update_tax_ids = fields.Many2many('account.tax', 'pos_config_tax_rel', 'config_id', 'tax_id', string='List Taxes')
    subtotal_tax_included = fields.Boolean(
        'Show Tax-Included Prices',
        help='If active, sub total each line will display total within tax included. \n'
             'Applied on each line of order cart and bill receipt')
    cash_out = fields.Boolean('Take money out', default=0, help='Allow cashiers take money out')
    cash_in = fields.Boolean('Push money in', default=0, help='Allow cashiers input money in')
    min_length_search = fields.Integer('Min Character Search', default=3,
                                       help='Allow auto suggestion items when cashiers input on search box')
    review_receipt_before_paid = fields.Boolean('Display Receipt Before Payment',
                                                help='On Payment Screen and Client Screen,\n'
                                                     ' receipt will render left page for review',
                                                default=1)
    keyboard_event = fields.Boolean('Keyboard Event', default=1, help='Allow cashiers use shortcut keyboard')
    switch_user = fields.Boolean('Switch user', default=0, help='Allow cashiers user change between pos config')
    change_unit_of_measure = fields.Boolean('Change Unit of Measure', default=0,
                                            help='Allow cashiers change unit of measure of order lines')
    print_last_order = fields.Boolean('Print last receipt', default=0, help='Allow cashiers print last receipt')
    close_session = fields.Boolean('Logout when close session',
                                   help='When cashiers click close pos, auto log out of system',
                                   default=0)
    display_image_product = fields.Boolean('Display image product', default=1,
                                           help='Allow hide/display product images on pos screen')
    printer_on_off = fields.Boolean('On/Off printer', help='Help cashier turn on/off printer via posbox', default=0)
    check_duplicate_email = fields.Boolean('Check duplicate email', default=0)
    check_duplicate_phone = fields.Boolean('Check duplicate phone', default=0)
    hide_country = fields.Boolean('Hide Country', default=0)
    hide_barcode = fields.Boolean('Hide Barcode', default=0)
    hide_tax = fields.Boolean('Hide Taxes', default=0)
    hide_pricelist = fields.Boolean('Hide Pricelists', default=0)
    hide_supplier = fields.Boolean('Hide Suppiers', default=1)
    quickly_search_client = fields.Boolean("Quickly Search Client", default=1)
    show_order_unique_barcode = fields.Boolean('Show Unique Barcode',
                                               help='If your business have take away, customers come shop and order\n'
                                                    'When customer need to pay, cashiers dont know what order correct each customer\n'
                                                    'Each order we will add barcode for index order on receipt\n'
                                                    'When sellers take order from customers, they will give receipt have barcode included to customers\n'
                                                    'Customer need pay, they give receipt to your cashiers\n'
                                                    'Cashiers will use barcode device and scan this barcode\n'
                                                    'POS auto find order have this barcode, and auto switch to order have the same barcode\n'
                                                    'And so cashiers easy and made payment for customer')
    auto_remove_line = fields.Boolean('Auto Remove Line',
                                      default=1,
                                      help='When cashier set quantity of line to 0, \n'
                                           'line auto remove not keep line with qty is 0')
    chat = fields.Boolean('Chat message', default=0, help='Allow chat, discuss between pos sessions')
    add_tags = fields.Boolean('Add tags line', default=0, help='Allow cashiers add tags to order lines')
    add_sale_person = fields.Boolean('Add sale person', default=0)
    default_seller_id = fields.Many2one('res.users', 'Default seller')
    seller_ids = fields.Many2many('res.users', 'pos_config_sellers_rel', 'config_id', 'user_id', 'Sellers',
                                  help='Add sellers here, cashier can choice seller\n'
                                       ' and add to pos order on pos screen')
    force_seller = fields.Boolean('Force Seller',
                                  help='If checked, when cashier select sale person each line, auto assigned to sale person order',
                                  default=0)
    fast_remove_line = fields.Boolean('Fast remove line', default=1)
    logo = fields.Binary('Receipt logo')
    paid_full = fields.Boolean('Allow paid full', default=0,
                               help='Allow cashiers click one button, do payment full order')
    paid_partial = fields.Boolean('Allow partial payment', default=0, help='Allow cashiers do partial payment')
    backup = fields.Boolean('Backup/Restore orders', default=0,
                            help='Allow cashiers backup and restore orders on pos screen')
    backup_orders = fields.Text('Backup orders', readonly=1)
    change_logo = fields.Boolean('Change logo', default=1, help='Allow cashiers change logo of shop on pos screen')
    management_session = fields.Boolean('Management cash control', default=0)
    barcode_receipt = fields.Boolean('Barcode receipt', default=0)

    hide_mobile = fields.Boolean('Hide mobile', default=1)
    hide_phone = fields.Boolean('Hide phone', default=1)
    hide_email = fields.Boolean('Hide email', default=1)
    update_client = fields.Boolean('Update client',
                                   help='Uncheck if you dont want cashier change customer information on pos')
    add_client = fields.Boolean('Add client', help='Uncheck if you dont want cashier add new customers on pos')
    remove_client = fields.Boolean('Remove client', help='Uncheck if you dont want cashier remove customers on pos')
    mobile_responsive = fields.Boolean('Mobile responsive', default=0)

    hide_amount_total = fields.Boolean('Hide amount total', default=1)
    hide_amount_taxes = fields.Boolean('Hide amount taxes', default=1)

    report_no_of_report = fields.Integer(string="No.of Copy Receipt", default=1)
    report_signature = fields.Boolean(string="Report Signature", default=0)

    report_product_summary = fields.Boolean(string="Report Product Summary", default=0)
    report_product_current_month_date = fields.Boolean(string="Report This Month", default=0)

    report_order_summary = fields.Boolean(string='Report Order Summary', default=0)
    report_order_current_month_date = fields.Boolean(string="Report Current Month", default=0)

    report_payment_summary = fields.Boolean(string="Report Payment Summary", default=0)
    report_payment_current_month_date = fields.Boolean(string="Payment Current Month", default=0)

    active_product_sort_by = fields.Boolean('Active product sort by', default=0)
    default_product_sort_by = fields.Selection([
        ('a_z', 'Sort from A to Z'),
        ('z_a', 'Sort from Z to A'),
        ('low_price', 'Sort from low to high price'),
        ('high_price', 'Sort from high to low price'),
        ('pos_sequence', 'Product pos sequence')
    ], string='Default sort by', default='a_z')
    add_customer_before_products_already_in_shopping_cart = fields.Boolean('Required add client first',
                                                                           help='Add customer before products \n'
                                                                                'already in shopping cart',
                                                                           default=0)
    allow_cashier_select_pricelist = fields.Boolean('Allow cashier use pricelist',
                                                    help='If uncheck, pricelist only work when select customer.\n'
                                                         ' Cashiers could not manual choose pricelist',
                                                    default=1)
    sale_with_package = fields.Boolean('Sale with Package')
    allow_set_price_smaller_min_price = fields.Boolean('Allow cashier set price smaller than public price', default=1)
    checking_lot = fields.Boolean('Validate lot/serial number',
                                  help='Validate lot name input by cashiers is wrong or correctly')

    sync_sales = fields.Boolean('Sync Sales/Quotations', default=1,
                                help='Synchronize quotations/sales order between backend and pos')
    auto_nextscreen_when_validate_payment = fields.Boolean('Auto next screen when cashiers validated payment',
                                                           default=1)
    auto_print_web_receipt = fields.Boolean('Auto Print Web Receipt', default=1)
    multi_lots = fields.Boolean('Multi lots', help='One order line can set many lots')
    create_lots = fields.Boolean('Create lots', help='Allow cashier create lots on pos')
    promotion_ids = fields.Many2many('pos.promotion',
                                     'pos_config_promotion_rel',
                                     'config_id',
                                     'promotion_id',
                                     string='Promotions Applied')
    required_reinstall_cache = fields.Boolean('Required reinstall cache',
                                              help='Check to box if you need when pos session start,\n'
                                                   ' auto reinstall cache')
    allow_sync_direct = fields.Boolean(
        'Allow sync Direct Backend',
        default=0,
        help='If active, all event update of Products, Customers auto sync to POS Session Online \n'
             'If your backend import datas or have big changes Customers/Products \n'
             'All event sync to POS Online will required have loading times, may be slow action sale of POS session\n'
             'PLease made sure it before active this future')
    replace_payment_screen = fields.Boolean('Replace Payment Screen', default=0,
                                            help='If checked, payment screen and products made to one \n'
                                                 'Keyboard of payment screen will turn off\n'
                                                 'This future only support on PC, without mobile tablet')
    auto_reconcile_payments = fields.Boolean('Auto Reconcile Payments', default=0,
                                             help='End of day, cashiers need validate and closing sessions. \n'
                                                  'POS Odoo original take longs times for closing\n'
                                                  'If you checked this checkbox, each 1 hour cron job (schedule) auto process to close.')

    pos_branch_id = fields.Many2one(
        'pos.branch',
        'Branch',
        help='If you set branch here, only users have assigned of branch will see this pos config \n'
             'All products have branch the same with this branch will display in pos screen\n'
             'All pos category have branch the same with this branch will display in pos screen'
    )

    stock_location_ids = fields.Many2many(
        'stock.location', string='Stock Locations',
        domain=[('usage', '=', 'internal')])
    validate_by_manager = fields.Boolean('Validate by Manager')
    discount_unlock_by_manager = fields.Boolean('Unlock Limit Discount by Manager')
    manager_ids = fields.Many2many('res.users', 'pos_config_res_user_manager_rel', 'config_id', 'user_id',
                                   string='Manager Validation')
    push_order_no_wait = fields.Boolean(
        'Push Order No Wait',
        help='If checked, orders submit from POS Session will save with state is New\n'
             'Each 15 minutes, all orders state New will auto process to Paid by system Schedule\n')

    limit_categories = fields.Boolean("Restrict Available Product Categories")
    iface_available_categ_ids = fields.Many2many(
        'pos.category',
        string='Available PoS Product Categories',
        help='The point of sale will only display products \n'
             'which are within one of the selected category trees. \n'
             'If no category is specified, all available products will be shown')
    membership_ids = fields.Many2many(
        'res.partner.group',
        'pos_config_res_partner_group_rel',
        'config_id',
        'group_id',
        string='Customer Groups/Membership')
    barcode_scan_with_camera = fields.Boolean(
        'Use Camera Scan Barcode',
        help='If you check it, and your device use POS have camera \n'
             'You can use camera of device scan barcode for add products, return orders ....\n'
             'This future only supported web browse and SSL \n'
             'SSL required if you are on cloud. As without SSL permission of camera not work.'
    )

    @api.multi
    def lock_session(self, vals):
        return self.sudo().write(vals)

    @api.model
    def switch_mobile_mode(self, config_id, vals):
        if vals.get('mobile_responsive') == True:
            vals['product_view'] = 'box'
        return self.browse(config_id).sudo().write(vals)

    @api.multi
    def update_required_reinstall_cache(self):
        return self.write({'required_reinstall_cache': False})

    @api.multi
    def reinstall_database(self):
        ###########################################################################################################
        # new field append :
        #                    - update param
        #                    - remove logs datas
        #                    - remove cache
        #                    - reload pos
        #                    - reinstall pos data
        # reinstall data button:
        #                    - remove all param
        #                    - pos start save param
        #                    - pos reinstall with new param
        # refresh call logs:
        #                    - get fields domain from param
        #                    - refresh data with new fields and domain
        ###########################################################################################################
        parameters = self.env['ir.config_parameter'].sudo().search([('key', 'in',
                                                                     ['product.product', 'res.partner',
                                                                      'account.invoice',
                                                                      'account.invoice.line', 'pos.order',
                                                                      'pos.order.line',
                                                                      'sale.order', 'sale.order.line'])])
        if parameters:
            parameters.sudo().unlink()
        del_database_sql = ''' delete from pos_cache_database'''
        del_log_sql = ''' delete from pos_call_log'''
        self.env.cr.execute(del_database_sql)
        self.env.cr.execute(del_log_sql)
        self.env.cr.commit()
        for config in self:
            configs = self.search([('id', '!=', config.id)])
            configs.write({'required_reinstall_cache': True})
        return {
            'type': 'ir.actions.act_url',
            'url': '/pos/web',
            'target': 'self',
        }

    @api.multi
    def remote_sessions(self):
        return {
            'name': _('Remote sessions'),
            'view_type': 'form',
            'target': 'new',
            'view_mode': 'form',
            'res_model': 'pos.remote.session',
            'view_id': False,
            'type': 'ir.actions.act_window',
            'context': {},
        }

    def validate_and_post_entries_session(self):
        for config in self:
            sessions = self.env['pos.session'].search([('config_id', '=', config.id), ('state', '=', 'opened')])
            if sessions:
                sessions.action_pos_session_closing_control()
                sessions.action_pos_session_validate()

    @api.onchange('lock_print_invoice_on_pos')
    def _onchange_lock_print_invoice_on_pos(self):
        if self.lock_print_invoice_on_pos == True:
            self.receipt_invoice_number = False
            self.send_invoice_email = True
        else:
            self.receipt_invoice_number = True
            self.send_invoice_email = False

    @api.onchange('receipt_invoice_number')
    def _onchange_receipt_invoice_number(self):
        if self.receipt_invoice_number == True:
            self.lock_print_invoice_on_pos = False
        else:
            self.lock_print_invoice_on_pos = True

    @api.onchange('pos_auto_invoice')
    def _onchange_pos_auto_invoice(self):
        if self.pos_auto_invoice == True:
            self.iface_invoicing = True
        else:
            self.iface_invoicing = False

    @api.onchange('staff_level')
    def on_change_staff_level(self):
        if self.staff_level and self.staff_level == 'manager':
            self.lock_order_printed_receipt = False

    @api.multi
    def write(self, vals):
        if vals.get('allow_discount', False) or vals.get('allow_qty', False) or vals.get('allow_price', False):
            vals['allow_numpad'] = True
        if vals.get('expired_days_voucher', None) and vals.get('expired_days_voucher') < 0:
            raise UserError('Expired days of voucher could not smaller than 0')
        for config in self:
            if vals.get('management_session', False) and not vals.get('default_cashbox_lines_ids'):
                if not config.default_cashbox_lines_ids and not config.cash_control:
                    raise UserError('Please go to Cash control and add Default Opening')
            if config.pos_order_period_return_days < 0:
                raise UserError('Period days return orders and products required bigger than or equal 0 day')
        res = super(pos_config, self).write(vals)
        return res

    @api.model
    def create(self, vals):
        if vals.get('allow_discount', False) or vals.get('allow_qty', False) or vals.get('allow_price', False):
            vals['allow_numpad'] = True
        if vals.get('expired_days_voucher', 0) < 0:
            raise UserError('Expired days of voucher could not smaller than 0')
        config = super(pos_config, self).create(vals)
        if config.pos_order_period_return_days < 0:
            raise UserError('Period days return orders and products required bigger than or equal 0 day')
        if config.management_session and not config.default_cashbox_lines_ids and not config.cash_control:
            raise UserError('Please go to Cash control and add Default Opening')
        return config

    def init_wallet_journal(self):
        Journal = self.env['account.journal']
        user = self.env.user
        wallet_journal = Journal.sudo().search([
            ('code', '=', 'UWJ'),
            ('company_id', '=', user.company_id.id),
        ])
        if wallet_journal:
            return wallet_journal.sudo().write({
                'pos_method_type': 'wallet'
            })
        Account = self.env['account.account']
        wallet_account_old_version = Account.sudo().search([
            ('code', '=', 'AUW'), ('company_id', '=', user.company_id.id)])
        if wallet_account_old_version:
            wallet_account = wallet_account_old_version[0]
        else:
            wallet_account = Account.sudo().create({
                'name': 'Account wallet',
                'code': 'AUW',
                'user_type_id': self.env.ref('account.data_account_type_current_assets').id,
                'company_id': user.company_id.id,
                'note': 'code "AUW" auto give wallet amount of customers',
            })
            self.env['ir.model.data'].sudo().create({
                'name': 'account_use_wallet' + str(user.company_id.id),
                'model': 'account.account',
                'module': 'pos_retail',
                'res_id': wallet_account.id,
                'noupdate': True,  # If it's False, target record (res_id) will be removed while module update
            })

        wallet_journal_inactive = Journal.sudo().search([
            ('code', '=', 'UWJ'),
            ('company_id', '=', user.company_id.id),
            ('pos_method_type', '=', 'wallet')
        ])
        if wallet_journal_inactive:
            wallet_journal_inactive.sudo().write({
                'default_debit_account_id': wallet_account.id,
                'default_credit_account_id': wallet_account.id,
                'pos_method_type': 'wallet',
                'sequence': 100,
            })
            wallet_journal = wallet_journal_inactive
        else:
            new_sequence = self.env['ir.sequence'].sudo().create({
                'name': 'Account Default Wallet Journal ' + str(user.company_id.id),
                'padding': 3,
                'prefix': 'UW ' + str(user.company_id.id),
            })
            self.env['ir.model.data'].sudo().create({
                'name': 'journal_sequence' + str(new_sequence.id),
                'model': 'ir.sequence',
                'module': 'pos_retail',
                'res_id': new_sequence.id,
                'noupdate': True,
            })
            wallet_journal = Journal.sudo().create({
                'name': 'Wallet',
                'code': 'UWJ',
                'type': 'cash',
                'pos_method_type': 'wallet',
                'journal_user': True,
                'sequence_id': new_sequence.id,
                'company_id': user.company_id.id,
                'default_debit_account_id': wallet_account.id,
                'default_credit_account_id': wallet_account.id,
                'sequence': 100,
            })
            self.env['ir.model.data'].sudo().create({
                'name': 'use_wallet_journal_' + str(wallet_journal.id),
                'model': 'account.journal',
                'module': 'pos_retail',
                'res_id': int(wallet_journal.id),
                'noupdate': True,
            })

        config = self
        config.sudo().write({
            'journal_ids': [(4, wallet_journal.id)],
        })

        statement = [(0, 0, {
            'journal_id': wallet_journal.id,
            'user_id': user.id,
            'company_id': user.company_id.id
        })]
        current_session = config.current_session_id
        current_session.sudo().write({
            'statement_ids': statement,
        })
        return

    def init_voucher_journal(self):
        Journal = self.env['account.journal']
        user = self.env.user
        voucher_journal = Journal.sudo().search([
            ('code', '=', 'VCJ'),
            ('company_id', '=', user.company_id.id),
        ])
        if voucher_journal:
            return voucher_journal.sudo().write({
                'pos_method_type': 'voucher'
            })
        Account = self.env['account.account']
        voucher_account_old_version = Account.sudo().search([
            ('code', '=', 'AVC'), ('company_id', '=', user.company_id.id)])
        if voucher_account_old_version:
            voucher_account = voucher_account_old_version[0]
        else:
            voucher_account = Account.sudo().create({
                'name': 'Account voucher',
                'code': 'AVC',
                'user_type_id': self.env.ref('account.data_account_type_current_assets').id,
                'company_id': user.company_id.id,
                'note': 'code "AVC" auto give voucher histories of customers',
            })
            self.env['ir.model.data'].sudo().create({
                'name': 'account_voucher' + str(user.company_id.id),
                'model': 'account.account',
                'module': 'pos_retail',
                'res_id': voucher_account.id,
                'noupdate': True,  # If it's False, target record (res_id) will be removed while module update
            })

        voucher_journal = Journal.sudo().search([
            ('code', '=', 'VCJ'),
            ('company_id', '=', user.company_id.id),
            ('pos_method_type', '=', 'voucher')
        ])
        if voucher_journal:
            voucher_journal[0].sudo().write({
                'voucher': True,
                'default_debit_account_id': voucher_account.id,
                'default_credit_account_id': voucher_account.id,
                'pos_method_type': 'voucher',
                'sequence': 101,
            })
            voucher_journal = voucher_journal[0]
        else:
            new_sequence = self.env['ir.sequence'].sudo().create({
                'name': 'Account Voucher ' + str(user.company_id.id),
                'padding': 3,
                'prefix': 'AVC ' + str(user.company_id.id),
            })
            self.env['ir.model.data'].sudo().create({
                'name': 'journal_sequence' + str(new_sequence.id),
                'model': 'ir.sequence',
                'module': 'pos_retail',
                'res_id': new_sequence.id,
                'noupdate': True,
            })
            voucher_journal = Journal.sudo().create({
                'name': 'Voucher',
                'code': 'VCJ',
                'type': 'cash',
                'pos_method_type': 'voucher',
                'journal_user': True,
                'sequence_id': new_sequence.id,
                'company_id': user.company_id.id,
                'default_debit_account_id': voucher_account.id,
                'default_credit_account_id': voucher_account.id,
                'sequence': 101,
            })
            self.env['ir.model.data'].sudo().create({
                'name': 'journal_voucher_' + str(voucher_journal.id),
                'model': 'account.journal',
                'module': 'pos_retail',
                'res_id': int(voucher_journal.id),
                'noupdate': True,
            })

        config = self
        config.sudo().write({
            'journal_ids': [(4, voucher_journal.id)],
        })

        statement = [(0, 0, {
            'journal_id': voucher_journal.id,
            'user_id': user.id,
            'company_id': user.company_id.id
        })]
        current_session = config.current_session_id
        current_session.sudo().write({
            'statement_ids': statement,
        })
        return

    def init_credit_journal(self):
        Journal = self.env['account.journal']
        user = self.env.user
        voucher_journal = Journal.sudo().search([
            ('code', '=', 'CJ'),
            ('company_id', '=', user.company_id.id),
        ])
        if voucher_journal:
            return voucher_journal.sudo().write({
                'pos_method_type': 'credit'
            })
        Account = self.env['account.account']
        credit_account_old_version = Account.sudo().search([
            ('code', '=', 'ACJ'), ('company_id', '=', user.company_id.id)])
        if credit_account_old_version:
            credit_account = credit_account_old_version[0]
        else:
            credit_account = Account.sudo().create({
                'name': 'Credit Account',
                'code': 'CA',
                'user_type_id': self.env.ref('account.data_account_type_current_assets').id,
                'company_id': user.company_id.id,
                'note': 'code "CA" give credit payment customer',
            })
            self.env['ir.model.data'].sudo().create({
                'name': 'account_credit' + str(user.company_id.id),
                'model': 'account.account',
                'module': 'pos_retail',
                'res_id': credit_account.id,
                'noupdate': True,  # If it's False, target record (res_id) will be removed while module update
            })

        credit_journal = Journal.sudo().search([
            ('code', '=', 'CJ'),
            ('company_id', '=', user.company_id.id),
            ('pos_method_type', '=', 'credit')
        ])
        if credit_journal:
            credit_journal[0].sudo().write({
                'credit': True,
                'default_debit_account_id': credit_account.id,
                'default_credit_account_id': credit_account.id,
                'pos_method_type': 'credit',
                'sequence': 102,
            })
            credit_journal = credit_journal[0]
        else:
            new_sequence = self.env['ir.sequence'].sudo().create({
                'name': 'Credit account ' + str(user.company_id.id),
                'padding': 3,
                'prefix': 'CA ' + str(user.company_id.id),
            })
            self.env['ir.model.data'].sudo().create({
                'name': 'journal_sequence' + str(new_sequence.id),
                'model': 'ir.sequence',
                'module': 'pos_retail',
                'res_id': new_sequence.id,
                'noupdate': True,
            })
            credit_journal = Journal.sudo().create({
                'name': 'Customer Credit',
                'code': 'CJ',
                'type': 'cash',
                'pos_method_type': 'credit',
                'journal_user': True,
                'sequence_id': new_sequence.id,
                'company_id': user.company_id.id,
                'default_debit_account_id': credit_account.id,
                'default_credit_account_id': credit_account.id,
                'sequence': 102,
            })
            self.env['ir.model.data'].sudo().create({
                'name': 'credit_journal_' + str(credit_journal.id),
                'model': 'account.journal',
                'module': 'pos_retail',
                'res_id': int(credit_journal.id),
                'noupdate': True,
            })

        config = self
        config.sudo().write({
            'journal_ids': [(4, credit_journal.id)],
        })

        statement = [(0, 0, {
            'journal_id': credit_journal.id,
            'user_id': user.id,
            'company_id': user.company_id.id
        })]
        current_session = config.current_session_id
        current_session.sudo().write({
            'statement_ids': statement,
        })
        return True

    def init_return_order_journal(self):
        Journal = self.env['account.journal']
        user = self.env.user
        return_journal = Journal.sudo().search([
            ('code', '=', 'ROJ'),
            ('company_id', '=', user.company_id.id),
        ])
        if return_journal:
            return return_journal.sudo().write({
                'pos_method_type': 'return'
            })
        Account = self.env['account.account']
        return_account_old_version = Account.sudo().search([
            ('code', '=', 'ARO'), ('company_id', '=', user.company_id.id)])
        if return_account_old_version:
            return_account = return_account_old_version[0]
        else:
            return_account = Account.sudo().create({
                'name': 'Return Order Account',
                'code': 'ARO',
                'user_type_id': self.env.ref('account.data_account_type_current_assets').id,
                'company_id': user.company_id.id,
                'note': 'code "ARO" give return order from customer',
            })
            self.env['ir.model.data'].sudo().create({
                'name': 'return_account' + str(user.company_id.id),
                'model': 'account.account',
                'module': 'pos_retail',
                'res_id': return_account.id,
                'noupdate': True,  # If it's False, target record (res_id) will be removed while module update
            })

        return_journal = Journal.sudo().search([
            ('code', '=', 'ROJ'),
            ('company_id', '=', user.company_id.id),
        ])
        if return_journal:
            return_journal[0].sudo().write({
                'default_debit_account_id': return_account.id,
                'default_credit_account_id': return_account.id,
                'pos_method_type': 'return'
            })
            return_journal = return_journal[0]
        else:
            new_sequence = self.env['ir.sequence'].sudo().create({
                'name': 'Return account ' + str(user.company_id.id),
                'padding': 3,
                'prefix': 'RA ' + str(user.company_id.id),
            })
            self.env['ir.model.data'].sudo().create({
                'name': 'journal_sequence' + str(new_sequence.id),
                'model': 'ir.sequence',
                'module': 'pos_retail',
                'res_id': new_sequence.id,
                'noupdate': True,
            })
            return_journal = Journal.sudo().create({
                'name': 'Return Order Customer',
                'code': 'ROJ',
                'type': 'cash',
                'pos_method_type': 'return',
                'journal_user': True,
                'sequence_id': new_sequence.id,
                'company_id': user.company_id.id,
                'default_debit_account_id': return_account.id,
                'default_credit_account_id': return_account.id,
                'sequence': 103,
            })
            self.env['ir.model.data'].sudo().create({
                'name': 'return_journal_' + str(return_journal.id),
                'model': 'account.journal',
                'module': 'pos_retail',
                'res_id': int(return_journal.id),
                'noupdate': True,
            })

        config = self
        config.sudo().write({
            'journal_ids': [(4, return_journal.id)],
        })

        statement = [(0, 0, {
            'journal_id': return_journal.id,
            'user_id': user.id,
            'company_id': user.company_id.id
        })]
        current_session = config.current_session_id
        current_session.sudo().write({
            'statement_ids': statement,
        })
        return True

    def init_rounding_journal(self):
        Journal = self.env['account.journal']
        Account = self.env['account.account']
        user = self.env.user
        rounding_journal = Journal.sudo().search([
            ('code', '=', 'RDJ'),
            ('company_id', '=', user.company_id.id),
        ])
        if rounding_journal:
            return rounding_journal.sudo().write({
                'pos_method_type': 'rounding'
            })
        rounding_account_old_version = Account.sudo().search([
            ('code', '=', 'AAR'), ('company_id', '=', user.company_id.id)])
        if rounding_account_old_version:
            rounding_account = rounding_account_old_version[0]
        else:
            rounding_account = Account.sudo().create({
                'name': 'Rounding Account',
                'code': 'AAR',
                'user_type_id': self.env.ref('account.data_account_type_current_assets').id,
                'company_id': user.company_id.id,
                'note': 'code "AAR" give rounding pos order',
            })
            self.env['ir.model.data'].sudo().create({
                'name': 'rounding_account' + str(user.company_id.id),
                'model': 'account.account',
                'module': 'pos_retail',
                'res_id': rounding_account.id,
                'noupdate': True,
            })
        rounding_journal = Journal.sudo().search([
            ('pos_method_type', '=', 'rounding'),
            ('company_id', '=', user.company_id.id),
        ])
        if rounding_journal:
            rounding_journal[0].sudo().write({
                'name': 'Rounding',
                'default_debit_account_id': rounding_account.id,
                'default_credit_account_id': rounding_account.id,
                'pos_method_type': 'rounding',
                'code': 'RDJ'
            })
            rounding_journal = rounding_journal[0]
        else:
            new_sequence = self.env['ir.sequence'].sudo().create({
                'name': 'rounding account ' + str(user.company_id.id),
                'padding': 3,
                'prefix': 'RA ' + str(user.company_id.id),
            })
            self.env['ir.model.data'].sudo().create({
                'name': 'journal_sequence' + str(new_sequence.id),
                'model': 'ir.sequence',
                'module': 'pos_retail',
                'res_id': new_sequence.id,
                'noupdate': True,
            })
            rounding_journal = Journal.sudo().create({
                'name': 'Rounding',
                'code': 'RDJ',
                'type': 'cash',
                'pos_method_type': 'rounding',
                'journal_user': True,
                'sequence_id': new_sequence.id,
                'company_id': user.company_id.id,
                'default_debit_account_id': rounding_account.id,
                'default_credit_account_id': rounding_account.id,
                'sequence': 103,
            })
            self.env['ir.model.data'].sudo().create({
                'name': 'rounding_journal_' + str(rounding_journal.id),
                'model': 'account.journal',
                'module': 'pos_retail',
                'res_id': int(rounding_journal.id),
                'noupdate': True,
            })

        config = self
        config.sudo().write({
            'journal_ids': [(4, rounding_journal.id)],
        })

        statement = [(0, 0, {
            'journal_id': rounding_journal.id,
            'user_id': user.id,
            'company_id': user.company_id.id
        })]
        current_session = config.current_session_id
        current_session.sudo().write({
            'statement_ids': statement,
        })
        return True

    @api.multi
    def open_ui(self):
        res = super(pos_config, self).open_ui()
        self.init_voucher_journal()
        self.init_wallet_journal()
        self.init_credit_journal()
        self.init_return_order_journal()
        self.init_rounding_journal()
        return res

    @api.multi
    def open_session_cb(self):
        res = super(pos_config, self).open_session_cb()
        self.init_voucher_journal()
        self.init_wallet_journal()
        self.init_credit_journal()
        self.init_return_order_journal()
        self.init_rounding_journal()
        return res
