# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError


class pos_promotion(models.Model):
    _name = "pos.promotion"
    _description = "Management Promotion on pos"
    _order = "sequence, name"

    sequence = fields.Integer(help="Gives the sequence promotion when displaying a list of promotions active")
    name = fields.Char('Name', required=1)
    active = fields.Boolean('Active', default=1)
    start_date = fields.Datetime('Start date', default=fields.Datetime.now(), required=1)
    end_date = fields.Datetime('End date', required=1)
    type = fields.Selection([
        ('1_discount_total_order', '1. Discount each amount total order'),
        ('2_discount_category', '2. Discount each category'),
        ('3_discount_by_quantity_of_product', '3. Discount each quantity of product'),
        ('4_pack_discount', '4. Buy pack products discount products'),
        ('5_pack_free_gift', '5. Buy pack products free products'),
        ('6_price_filter_quantity', '6. Sale off products'),
        ('7_special_category', '7. Discount each special category'),
        ('8_discount_lowest_price', '8. Discount lowest price'),
        ('9_multi_buy', '9. Multi buy - By n(qty) with price'),
        ('10_buy_x_get_another_free', '10. Buy min qty get free item'),
        ('11_first_order', '11. Discount % first order'),
    ], 'Type', default='1_discount_total_order', required=1, help=
    '1: each total amount of order, each discount\n'
    '2: each category set each discount\n'
    '3: each quantities of product each discount\n'
    '4: set pack products customer buy, discount another products\n'
    '5: set pack products customer buy, free products gift \n'
    '6: each quantity product customer buy, each price\n'
    '7: discount or free gift when customer buy product of category selected \n'
    '8: set discount on product lowest price of list products customer buy\n'
    '9: part of quantity product will apply another price (low of sale price product)\n'
    '10: Min qty get free (total qty / min) product buy. Example: buy 3 box free 1, buy 6 box free 2 ...\n'
    '11. Discount first order of customer')
    discount_first_order = fields.Float('Discount (x) %')
    product_id = fields.Many2one('product.product', 'Product service', domain=[('available_in_pos', '=', True)])
    discount_order_ids = fields.One2many('pos.promotion.discount.order', 'promotion_id', 'Discounts')
    discount_category_ids = fields.One2many('pos.promotion.discount.category', 'promotion_id', 'Categories Discounts')
    discount_quantity_ids = fields.One2many('pos.promotion.discount.quantity', 'promotion_id', 'Quantities Discounts')
    gift_condition_ids = fields.One2many('pos.promotion.gift.condition', 'promotion_id', 'Gifts condition')
    gift_free_ids = fields.One2many('pos.promotion.gift.free', 'promotion_id', 'Gifts apply')
    discount_condition_ids = fields.One2many('pos.promotion.discount.condition', 'promotion_id', 'Discounts condition')
    discount_apply_ids = fields.One2many('pos.promotion.discount.apply', 'promotion_id', 'Discounts apply')
    price_ids = fields.One2many('pos.promotion.price', 'promotion_id', 'Prices')
    special_category_ids = fields.One2many('pos.promotion.special.category', 'promotion_id', 'Special Category')
    discount_lowest_price = fields.Float('Discount (%)', help='Discount n(%) of product lowest price of order lines')
    multi_buy_ids = fields.One2many('pos.promotion.multi.buy', 'promotion_id', 'Multi Buy')
    product_ids = fields.Many2many('product.product', 'promotion_product_rel', 'promotion_id', 'product_id',
                                   string='Products group', domain=[('available_in_pos', '=', True)])
    minimum_items = fields.Integer('Minimum items',
                                   help='How many items need to be in the basket when the discount apply')
    special_customer_ids = fields.Many2many('res.partner', 'promotion_partner_rel', 'promotion_id', 'partner_id',
                                            string='Special customer', help='Only customers added will apply promotion',
                                            domain=[('customer', '=', True)])
    promotion_birthday = fields.Boolean('Promotion at birthday customers')
    promotion_birthday_type = fields.Selection([
        ('day', 'Birthday same day'),
        ('week', 'Birthday in week'),
        ('month', 'Birthday in month')
    ], striing='Time apply', default='week')

    promotion_group = fields.Boolean('Promotion groups customer')
    promotion_group_ids = fields.Many2many('res.partner.group',
                                 'pos_promotion_partner_group_rel',
                                 'promotion_id',
                                 'group_id',
                                 string='Customer Groups')
    state = fields.Selection([
        ('active', 'Active'),
        ('disable', 'Disable')
    ], string='State', default='active')
    
    @api.multi
    def sync_promotion_all_pos_online(self):
        sessions = self.env['pos.session'].sudo().search([
            ('state', '=', 'opened')
        ])
        for session in sessions:
            self.env['bus.bus'].sendmany(
                [[(self.env.cr.dbname, 'pos.sync.promotions', session.user_id.id), {}]])
        return True

    @api.model
    def default_get(self, fields):
        res = super(pos_promotion, self).default_get(fields)
        products = self.env['product.product'].search([('name', '=', 'Promotion service')])
        if products:
            res.update({'product_id': products[0].id})
        return res

    @api.model
    def create(self, vals):
        promotion = super(pos_promotion, self).create(vals)
        if promotion and promotion.product_id and not promotion.product_id.available_in_pos:
            raise UserError('Product service not available in POS. \n'
                            'Please go to product and check to checkbox available in pos / save')
        return promotion

    @api.multi
    def write(self, vals):
        res = super(pos_promotion, self).write(vals)
        for promotion in self:
            if promotion and promotion.product_id and not promotion.product_id.available_in_pos:
                raise UserError('Product service not available in POS. \n'
                                'Please go to product and check to checkbox available in pos / save')
        return res


class pos_promotion_discount_order(models.Model):
    _name = "pos.promotion.discount.order"
    _order = "minimum_amount"
    _description = "Promotion each total order"

    minimum_amount = fields.Float('Sub total min', required=1)
    discount = fields.Float('Discount %', required=1)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1, ondelete='cascade')


class pos_promotion_discount_category(models.Model):
    _name = "pos.promotion.discount.category"
    _order = "category_id, discount"
    _description = "Promotion each product categories"

    category_id = fields.Many2one('pos.category', 'POS Category', required=1)
    discount = fields.Float('Discount %', required=1)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1, ondelete='cascade')

    _sql_constraints = [
        ('category_id_uniq', 'unique(category_id)', 'one category only one rule!'),
    ]


class pos_promotion_discount_quantity(models.Model):
    _name = "pos.promotion.discount.quantity"
    _order = "product_id"
    _description = "Promotion discount each product quantities"

    product_id = fields.Many2one('product.product', 'Product', domain=[('available_in_pos', '=', True)], required=1)
    quantity = fields.Float('Minimum quantity', required=1)
    discount = fields.Float('Discount %', required=1)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1, ondelete='cascade')

    @api.model
    def create(self, vals):
        record = super(pos_promotion_discount_quantity, self).create(vals)
        if record and record.product_id and not record.product_id.available_in_pos:
            raise UserError('Product service not available in POS. \n'
                            'Please go to product and check to checkbox available in pos / save')
        return record

    @api.multi
    def write(self, vals):
        res = super(pos_promotion_discount_quantity, self).write(vals)
        for record in self:
            if record and record.product_id and not record.product_id.available_in_pos:
                raise UserError('Product service not available in POS. \n'
                                'Please go to product and check to checkbox available in pos / save')
        return res


class pos_promotion_gift_condition(models.Model):
    _name = "pos.promotion.gift.condition"
    _order = "product_id, minimum_quantity"
    _description = "Promotion gift condition"

    product_id = fields.Many2one('product.product', domain=[('available_in_pos', '=', True)], string='Product',
                                 required=1)
    minimum_quantity = fields.Float('Qty greater or equal', required=1, default=1.0)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1, ondelete='cascade')

    @api.model
    def create(self, vals):
        record = super(pos_promotion_gift_condition, self).create(vals)
        if record and record.product_id and not record.product_id.available_in_pos:
            raise UserError('Product service not available in POS. \n'
                            'Please go to product and check to checkbox available in pos / save')
        return record

    @api.multi
    def write(self, vals):
        res = super(pos_promotion_gift_condition, self).write(vals)
        for record in self:
            if record and record.product_id and not record.product_id.available_in_pos:
                raise UserError('Product service not available in POS. \n'
                                'Please go to product and check to checkbox available in pos / save')
        return res


class pos_promotion_gift_free(models.Model):
    _name = "pos.promotion.gift.free"
    _order = "product_id"
    _description = "Promotion give gift to customer"

    product_id = fields.Many2one('product.product', domain=[('available_in_pos', '=', True)], string='Product gift',
                                 required=1)
    quantity_free = fields.Float('Quantity free', required=1, default=1.0)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1, ondelete='cascade')
    type = fields.Selection([
        ('only_one', 'Only free quantity the same with quantity free set'),
        ('multi', 'Multi free, example: buy 3 free 1, buy 6 free 2'),
    ], default='only_one', string='Type for use', required=1)

    @api.model
    def create(self, vals):
        record = super(pos_promotion_gift_free, self).create(vals)
        if record and record.product_id and not record.product_id.available_in_pos:
            raise UserError('Product service not available in POS. \n'
                            'Please go to product and check to checkbox available in pos / save')
        return record

    @api.multi
    def write(self, vals):
        res = super(pos_promotion_gift_free, self).write(vals)
        for record in self:
            if record and record.product_id and not record.product_id.available_in_pos:
                raise UserError('Product service not available in POS. \n'
                                'Please go to product and check to checkbox available in pos / save')
        return res


class pos_promotion_discount_condition(models.Model):
    _name = "pos.promotion.discount.condition"
    _order = "product_id, minimum_quantity"
    _description = "Promotion discount condition"

    product_id = fields.Many2one('product.product', domain=[('available_in_pos', '=', True)], string='Product',
                                 required=1)
    minimum_quantity = fields.Float('Qty greater or equal', required=1, default=1.0)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1, ondelete='cascade')

    @api.model
    def create(self, vals):
        record = super(pos_promotion_discount_condition, self).create(vals)
        if record and record.product_id and not record.product_id.available_in_pos:
            raise UserError('Product service not available in POS. \n'
                            'Please go to product and check to checkbox available in pos / save')
        return record

    @api.multi
    def write(self, vals):
        res = super(pos_promotion_discount_condition, self).write(vals)
        for record in self:
            if record and record.product_id and not record.product_id.available_in_pos:
                raise UserError('Product service not available in POS. \n'
                                'Please go to product and check to checkbox available in pos / save')
        return res


class pos_promotion_discount_apply(models.Model):
    _name = "pos.promotion.discount.apply"
    _order = "product_id"
    _description = "Promotion discount apply"

    product_id = fields.Many2one('product.product', domain=[('available_in_pos', '=', True)], string='Product',
                                 required=1)
    type = fields.Selection([
        ('one', 'Discount only one quantity'),
        ('all', 'Discount all quantity'),
    ], string='Type', default='one')
    discount = fields.Float('Discount %', required=1, default=1.0)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1, ondelete='cascade')

    @api.model
    def create(self, vals):
        record = super(pos_promotion_discount_apply, self).create(vals)
        if record and record.product_id and not record.product_id.available_in_pos:
            raise UserError('Product service not available in POS. \n'
                            'Please go to product and check to checkbox available in pos / save')
        return record

    @api.multi
    def write(self, vals):
        res = super(pos_promotion_discount_apply, self).write(vals)
        for record in self:
            if record and record.product_id and not record.product_id.available_in_pos:
                raise UserError('Product service not available in POS. \n'
                                'Please go to product and check to checkbox available in pos / save')
        return res


class pos_promotion_price(models.Model):
    _name = "pos.promotion.price"
    _order = "product_id, minimum_quantity"
    _description = "Promotion sale off"

    product_id = fields.Many2one('product.product', domain=[('available_in_pos', '=', True)], string='Product',
                                 required=1)
    minimum_quantity = fields.Float('Minimim quantity apply', required=1, default=1)
    price_down = fields.Float('Price down', required=1)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1, ondelete='cascade')

    @api.model
    def create(self, vals):
        product = self.env['product.product'].browse(vals['product_id'])
        if vals['price_down'] > product.lst_price:
            raise UserError('Price down could not bigger than product price %s' % product.lst_price)
        if not product.available_in_pos:
            raise UserError('Product service not available in POS. \n'
                            'Please go to product and check to checkbox available in pos / save')
        return super(pos_promotion_price, self).create(vals)

    @api.multi
    def write(self, vals):
        for record in self:
            if vals.get('price_down') and (vals.get('price_down') > record.product_id.lst_price):
                raise UserError('Price down could not bigger than product price %s' % record.product_id.lst_price)
            if not record.product_id.available_in_pos:
                raise UserError('Product service not available in POS. \n'
                                'Please go to product and check to checkbox available in pos / save')
        return super(pos_promotion_price, self).write(vals)


class pos_promotion_special_category(models.Model):
    _name = "pos.promotion.special.category"
    _order = "type"
    _description = "Promotion for special categories"

    category_id = fields.Many2one('pos.category', 'POS Category', required=1)
    type = fields.Selection([
        ('discount', 'Discount'),
        ('free', 'Free gift')
    ], string='Type', required=1, default='discount')
    count = fields.Integer('Count', help='How many product the same category will apply')
    discount = fields.Float('Discount %', required=1)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1, ondelete='cascade')
    product_id = fields.Many2one('product.product', 'Product apply', domain=[('available_in_pos', '=', True)])
    qty_free = fields.Float('Quantity gift', default=1)

    @api.model
    def create(self, vals):
        record = super(pos_promotion_special_category, self).create(vals)
        if record and record.product_id and not record.product_id.available_in_pos:
            raise UserError('Product service not available in POS. \n'
                            'Please go to product and check to checkbox available in pos / save')
        return record

    @api.multi
    def write(self, vals):
        res = super(pos_promotion_special_category, self).write(vals)
        for record in self:
            if record and record.product_id and not record.product_id.available_in_pos:
                raise UserError('Product service not available in POS. \n'
                                'Please go to product and check to checkbox available in pos / save')
        return res


class pos_promotion_multi_buy(models.Model):
    _name = "pos.promotion.multi.buy"
    _description = "Promotion for multi buy"

    product_id = fields.Many2one('product.product', domain=[('available_in_pos', '=', True)], string='Product',
                                 required=1)
    promotion_id = fields.Many2one('pos.promotion', 'Promotion', required=1, ondelete='cascade')
    list_price = fields.Float('For price', required=1)
    qty_apply = fields.Float('Qty with apply with this price', required=1, default=1)

    _sql_constraints = [
        ('product_id_uniq', 'unique(product_id)', 'only one product apply one rule!'),
    ]

    @api.model
    def create(self, vals):
        res = super(pos_promotion_multi_buy, self).create(vals)
        if vals.get('qty_apply') <= 0 or vals.get('list_price') <= 0:
            raise UserError('Next number and list price could not smaller than 0')
        if res and res.product_id and not res.product_id.available_in_pos:
            raise UserError('Product service not available in POS. \n'
                            'Please go to product and check to checkbox available in pos / save')
        return res

    @api.multi
    def write(self, vals):
        if (vals.get('qty_apply', None) and vals.get('qty_apply') <= 0) or (
                vals.get('list_price', None) and vals.get('list_price') <= 0):
            raise UserError('Next number and list price could not smaller than 0')
        res = super(pos_promotion_multi_buy, self).write(vals)
        for record in self:
            if record and record.product_id and not record.product_id.available_in_pos:
                raise UserError('Product service not available in POS. \n'
                                'Please go to product and check to checkbox available in pos / save')
        return res
