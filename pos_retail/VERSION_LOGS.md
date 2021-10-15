***7.2.1:*** add picking delayed, Allow picking create later (improve performance POS order). Cashier small times for waiting order process

***7.2.2:*** add option auto sync backend: Manual / Automatic

***7.2.3:*** Add dark mode

***7.2.4:*** Fixed promotion 3

***7.2.5:*** Improve promotion
- [x] 
- [x] 
- [x] 
- [x] 

***7.2.6:*** Add 2 button [Add promotion and remove promotion] on payment screen

***7.2.7:*** Fix bugs
- [x] Fix not clear search products when click product

***7.3.0:*** Fix bugs
- [x] Add button Validate and Post entries on dashboard pos backend: auto validate , pos entries of session selected, and auto close session still online
- [x] Improve sync order, remove function sync all orders, only sync order by order
- [x] Improve header top icon futures, move all to left bar
- [x] Fixed keyboard event
- [x] Fixed multi category
- [x] Fixed cash manager UI

***7.3.1:*** Promotion 5
- [x] Fixed condition and apply promotion 5 (buy pack free gifts)

***7.3.2:*** Improve stock on hand
- [x] Only update stock on hand on pos when stock move is done
- [x] Auto sync and refesh product screen when have stock move (done)
- [x] On pos config default picking delayed is false

***7.3.3:*** Improve lock pos screen
- [x] Add field lock state, when cashiers click lock, lock state is true, and when unlock, lock state is unlock
- [x] When admin not set pos pass pin for user, lock screen now allow input blank pass field

***7.3.3.1:*** Improve quickly search customers

***7.3.3.2:*** Fix price combo when have items default add or required add

***7.3.4:*** Protected code 

***7.3.4.1:*** Add widget show/hide branding list logo on header order widget

***7.3.4.2:*** Fixed bug

- [x] Remote session request remove cache , auto remove cached and reload pos
- [x] function init indexed db auto remove cache and reload pos if have catch exception

***7.3.4.2:*** Fixed bug

- [x] When create internal transfer, if have not stock locations have [availble in pos] will show popup warning
- [x] Move 3 buttons report to one button on header order widget
- [x] Fixed issue tax included when add combo items
- [x] Fixed issue add combo and quantity change
- [x] Fixed issue change qty, auto remove combo items. Required add back

***7.3.4.2:*** Hot fixed mobile app

- [x] Fixed issue return order, plus point and redeem point back to client

***7.3.4.4:*** 

- [x] Add promotion birthday of clients
- [x] Add promotion groups, add customer groups
- [x] Fixed multi unit not create stock move (unit) the same pos line (unit)
- [x] Add button sync pricelist to pos online without reload page
- [x] Add button sync promotions to pos online without reload page
- [x] Remove sync orders, invoice. When cashiers validate orders done, auto get new update from backend

***7.3.5*** We not stored xml receipt to backend for improve performance order save to backend

- [x] Add button push pricelist to pos without reload pos screen on pos config
- [x] On pos config form, add new button remote sessions
- [x] Improve refresh big data, auto reload and reinstall database if have any new field added

***7.3.5.1***

- [x] Fixed: If promotion birthday but client not set, return false
- [x] Fixed: Nothing report config, show popup error exception
- [x] When change pricelist, auto change pricelist realtime
- [x] Fixed issue quicly search client, auto call method save_changes of clientlist screen

***7.3.5.2***

- [x] Fixed promotion birthday
- [x] Improve sync between backend to pos
- [x] Fixed sync pricelist
- [x] Fixed module not get stock datas when start session


***7.3.5.3***

- [x] When admin click install/reinstall pos database, auto deleted pos database of admin
- [x] add field sequence for object promotions, promotions list will sort by sequence and name
- [x] Fix change fields product template not sync to pos
- [x] Fix issue of odoo original base model
- [x] Improve refresh call log
- [x] On pos call log view form add 1 button for manual refresh data
- [x] Method render_product() will check current view is list or box and change create Element (body or div), body is list and div is box
- [x] On product search view add more filter (is variant, is credit ....etc)
- [x] Fixed not get qty on hand of products when start pos (ronald reported)

***7.3.5.4***

- [x] add future add sale person to order and lines

***7.3.5.5***

-[x] fixed cost on post entries when pos sale product multi units

***7.3.5.6***

- [x] fixed issue UI/UX not show all payment method if have many payment methods
- [x] when payment order, only call backend and get orders just paid
- [x] fixed issue order partial orders paid full amount but state not become to 'paid'
- [x] each shop, only sync orders, invoices filter by shop
- [x] change title popup use points
- [x] fix quickly search partner on order widget

***7.3.5.7***

- [x] Only load order have config id the same config (session start)
- [x] when payment order and have promotion active , if auto apply, no show popup (because made receipt print viva web is wrong)
- [x] Fixed sale multi units base one product, auto covert stock move and account move line

***7.3.6.0***
- [x] Hide quickly actions
- [x] Add payment screen to product screen 
- [X] Add pos fast reconcile

***7.3.6.1***
- [x] Only one query backend when submit order
- [x] Remove any reference to mrp 

***7.4.0.0***
- [x] Remove sync stock, only sync when push orders
- [x] Remove sync backend, use threading push
- [x] Fixing calling printer voucher
- [x] On one order allow use many voucher
- [x] Remove 2 buttons: Note and Signature
- [x] Improve keyboard Shortcut
- [x] From any screens, back to products screen, add event keyboard back
- [x] Turn off sync when big datas field is unchecked

***7.4.0.1***
- [x] Not allow input birthday date bigger than now
- [x] Refactor .fail(error, type) to .fail(error)
- [x] Each popup, add textbox message issue (show why issue)
- [x] Allow order return and create 1 voucher with line selected

***7.4.0.3***
- [x] Sync without waiting times
- [x] product combo not allow merge with last line the same product
- [x] fixed issue create product from product operation screen

***7.4.0.4***
- [x] Add function checking polling work or not
- [x] Fixed cash control management

***7.4.0.5***
- [x] Improve multi stock warehouse locations
- [x] When go to sale orders screen, auto refresh screen
- [x] Display on hand on mobile

***7.4.0.5***
- [x] Improve multi lots
- [x] Auto sync stock production lot when click add multi lots button
- [x] Allow change location of order on POS

***7.4.0.8***
- [x] Add sale person to list view of pos / booked orders and pos orders
- [x] Sort by only render datas search before
- [x] Search sale person on pos orders and booked orders
- [x] Improve scan return orders and quickly return products 

***7.4.0.9***            
- [x] Multi branch each pos config and pos order
- [x] Create SO with location select by cashier
- [x] Format receipt made greater than

***7.4.1.0***
- [x] New UI/UX order widget and ticket bill
- [x] Fixed issue multi invoice journals
- [x] Partial payment required add client

***7.4.2.0***
- [x] Supported Only one use with multi session and multi pos config
- [x] Linked Employee to pos
- [x] Add sort list booked orders
- [x] No auto print if order is temporary

***7.4.2.1***
- [x] If uncheck allow sale when out of stock

***7.4.2.2***
- [x] Loyalty plus point allow rounding down to Integer
- [x] sync data with shadown is true (without waiting)

***7.4.2.3***
- [x] Loading stock on hand with shadow is true
- [x] Fixed closing pos session

***7.4.2.4***
- [x] Fixed issue printer report
- [x] Fixed issue print pos ticket
- [x] Fixed issue review receipt before paid
- [x] Display plus point to receipt

***7.4.2.5***
- [x] Improve validate actions (change qty, price ....)
- [x] Allow many manager approve discount (high discount and limit)
- [x] Urgent fix duplicate event click confirm and cancel of popup widget
- [x] Allow expired points

***7.5***
- [x] Define loyalty points in/out histories
- [x] Points of customer will count from 3 options
    - [x] Points import
    - [x] Points from Orders
    - [x] Points Expired histories
- [x] And so, made sure need upgrade to this version, backup 1 first and made sure all points customer not reduce
- [x] Fixed issue return order (not set discount back)
- [x] Add discount price
- [x] Fast closing session

***7.5.0.1***
- [x] Remove picking delayed
- [x] Return Order no need add payment method
- [x] Fixed bug return order, not reduce stock on hand
- [x] Allow put money in when payment full partial order
- [x] Picking Combo auto process at backend, no linked data from POS
- [x] Made sync faster than 100%
- [x] Add future quickly search clients viva popup

***7.5.0.2***
- [x] Display barcode unique each order, allow cashier scan on it and auto select order and go to payment screen
- [x] Fixed bug payment full partial orders
- [x] Fixed issue store pos config id on invoice table
- [x] Add backend screen pos loyalty point for import
- [x] Add schedule auto refresh logs peer day
- [x] Allow return order have combo lines, stock on hand auto plus to location
- [x] If not active big datas, no need to call refresh screen

***7.5.0.2***
- [x] Made product screen bigger than UI
- [x] Add purchased histories
- [x] Each purchased order, when cashier click, auto forward to orders screen
- [x] Check quantity available of order line selected apply new popup selection extend
- [x] Improve function update stock on hand each product

***7.5.1.0**
- [x] Big improve: we not store sale order, invoice and pos order to indexed DB
- [x] Only store 2 table partner and product
- [x] sale orders (called booked orders), invoice and inv line, pos orders and pos lines. Will loading directly backend
- [x] Remove icon change combo each line
- [x] Add choice combo items back
- [x] No need stored pos config id to invoice

***7.5.1.0**
- [x] Refactor method create picking with multi variants
- [x] Allow return order have lines included multi variants
- [x] Reduce stock on hand combo items if product link have type is Product

***7.5.1.1***
- [x] Fixed issue popup multi variants
- [x] Fixed issue write date of cache
- [x] Add only one event in and out search box at product screen
- [x] Add Guide title on buttons
- [x] Add purchased lines histories
- [x] Add title on buttons, div element suggestion keyboard event
- [x] Fixed Keyboard event, blur and focus. Auto add keyboard event back when blur
- [x] Fixed sync between sessions

***7.5.1.2***
- [x] Improved Booked Order, Invoice, Pos Order screen. Only add event on renderElement function. Now add on function show
- [x] Booked Order hide selected order if click to covert to pos order button
- [x] Fixed issue compute margin pos order line
- [x] When have booking order come, alert cashier

***7.5.1.4***
- [x] Fixed quickly add client not apply pricelist of client selected
- [x] Fixed return order give voucher to client
- [x] try catch function reformat_datetime

***7.5.1.5***
- [x] Hot fix issue remove sale order
- [x] No need notification cashiers if order booked deleted is true
- [x] Fixed bug return invoice of backend

***7.5.1.6***
- [x] Print Z-report directly on pos screen
- [x] Fixed mobile template

***7.5.2.0***
- [x] Improved sync between sessions
- [x] Sync viva posbox odoo
- [x] BIG IMPROVE: RESTORE BACK ANY ORDER SAVE ON IOT BOX OR ODOO SERVER (WITHOUT REMOVE CACHE)

***7.5.2.4***
- [x] Fixed Return Order used Redeem Points