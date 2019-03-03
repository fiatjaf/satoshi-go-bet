function __init__ ()
  return {
    tokens={},
    offers={},
    balances={}
  }
end

-- each bet token costs 10 satoshis
-- making a bet issues a token for black and a token for white
-- the token that wins will pay you back 10 satoshis, the other will pay 0
-- you can later sell your tokens for any price you want
local BETPRICE = 10

function newbet ()
  local gameid = payload.gameid
  local userid = payload.userid

  local amount = math.floor(satoshis / BETPRICE)
  if amount < 0 then
    error('amount must be positive')
  end

  if __checkgame (gameid) ~= nil then
    error('game already finished')
  end

  -- save the remainder to this users' balance
  local remainder = satoshis - (amount * BETPRICE)
  if remainder > 0 then
    local balance = state.balances[userid] or 0
    state.balances[userid] = balance + remainder
  end

  -- save tokens
  local bet = state.tokens[gameid] or {black={}, white={}}
  state.tokens[gameid] = bet
  bet.black[userid] = (bet.black[userid] or 0) + amount
  bet.white[userid] = (bet.white[userid] or 0) + amount
end

function selloffer ()
  local gameid = payload.gameid
  local amount = math.floor(payload.amount)
  local price = payload.price
  local winner = payload.winner
  local userid = payload.userid

  if userid ~= util.sha256(payload._key) then
    error("_key doesn't match")
  end

  if winner ~= 'black' and winner ~= 'white' then
    error('winner must be either black or white')
  end

  if amount <= 0 then
    error('amount must be positive')
  end

  if __checkgame (gameid) ~= nil then
    error('game already finished')
  end

  -- remove tokens from this user/bet balance
  local bet = state.tokens[gameid]
  local current = bet[winner][userid] or 0
  if current < amount then
    error("you can't sell more than you have")
  end
  bet[winner][userid] = current - amount

  -- put them in the offers
  local gameoffers = state.offers[gameid] or {}
  state.offers[gameid] = gameoffers

  local winneroffers = gameoffers[winner] or {}
  gameoffers[winner] = winneroffers

  table.insert(winneroffers, {amount=amount, price=price, seller=userid})

  -- smaller prices come first
  table.sort(winneroffers, function (left, right)
    return left.price < right.price
  end)
end

function unoffer ()
  local gameid = payload.gameid
  local userid = payload.userid
  local winner = payload.winner

  if userid ~= util.sha256(payload._key) then
    error("_key doesn't match")
  end

  if winner ~= 'black' and winner ~= 'white' then
    error('winner must be either black or white')
  end

  if __checkgame (gameid) ~= nil then
    error('game already finished')
  end

  local gamewinneroffers = state.offers[gameid][winner]
  for i, offer in ipairs(gamewinneroffers) do
    if offer.seller == userid then
      table.remove(gamewinneroffers, i)
      state.tokens[gameid][winner][userid] = state.tokens[gameid][winner][userid] + offer.amount
    end
  end
end

function buyoffer ()
  local gameid = payload.gameid
  local winner = payload.winner
  local userid = payload.userid
  local maxprice = payload.maxprice

  if winner ~= 'black' and winner ~= 'white' then
    error('winner must be either black or white')
  end

  if __checkgame (gameid) ~= nil then
    error('game already finished')
  end

  local input = satoshis
  local bought = 0
  local offers = state.offers[gameid][winner]

  for _, offer in ipairs(offers) do
    -- determine if we're going to stop buying
    if input == 0 or offer.price > maxprice then
      break
    end

    -- determine how much of this offer we're going to take
    local quantity = math.floor(input / offer.price)
    if quantity > offer.amount then
      -- take all
      quantity = offer.amount
    end
    bought = bought + quantity

    -- adjust
    -- -- remaining input money
    input = input - (quantity * offer.price)
    -- -- seller balances
    local sellerbalance = state.balances[offer.seller] or 0
    state.balances[offer.seller] = sellerbalance + (quantity * offer.price)
    -- -- buyer tokens
    local bet = state.tokens[gameid] or {black={}, white={}}
    state.tokens[gameid] = bet
    bet[winner][userid] = (bet[winner][userid] or 0) + quantity
    -- -- this offer
    offer.amount = offer.amount - quantity
  end

  -- clean offer array, removing 0-amount offers
  for i = #offers, 1, -1 do
    local offer = offers[i]
    if offer.amount == 0 then
      table.remove(offers, i)
    end
  end

  -- put remainder in buyer's balances
  if input > 0 then
    local balance = state.balances[userid] or 0
    state.balances[userid] = balance + input
  end

  local spent = (satoshis-input)
  return {bought=bought, spent=spent}
end

-- redeems all tokens for this game, can be called by anyone
function redeem ()
  local gameid = payload.gameid

  local tokens = state.tokens[gameid]
  if tokens == nil then
    error('unknown game, perhaps it was already redeemed.')
  end

  winner = __checkgame(gameid)
  if winner == nil then
    error("game not yet finished")
  end

  -- close all open offers for the winner
  -- (for the loser we can just ignore and delete in the next step)
  local gamewinneroffers = state.offers[gameid] or {}
  for i, offer in ipairs(gamewinneroffers) do
    state.tokens[gameid][winner][offer.seller] = state.tokens[gameid][winner][offer.seller] + offer.amount
  end

  -- then delete the offer container for this game
  state.offers[gameid] = nil

  -- redeem
  local bet = state.tokens[gameid]
  for userid, quantity in pairs(bet[winner]) do
    local redeemable = (quantity or 0) * BETPRICE

    local balance = state.balances[userid] or 0
    state.balances[userid] = balance + redeemable
  end

  state.tokens[gameid] = nil
end

function withdraw ()
  local userid = payload.userid

  if userid ~= util.sha256(payload._key) then
    error("_key doesn't match")
  end

  local balance = state.balances[userid] or 0
  local msatspaid, err = ln.pay(payload._invoice, {max=balance})
  if err ~= nil then
    error('invalid invoice: ' .. err)
  end

  state.balances[userid] = state.balances[userid] - msatspaid/1000
end

function __checkgame (gameid) -- returns winner, which is nil if the game isn't finished
  local game, err = http.getjson("https://online-go.com/api/v1/games/" .. gameid, {
    Accept='application/json'
  })

  if err ~= nil then
    error("game doesn't exist")
  end

  if game.gamedata.phase ~= 'finished' then
    return nil
  end

  local winner
  if game.black_lost and not game.white_lost then
    winner = 'white'
  elseif game.white_lost and not game.black_lost then
    winner = 'black'
  end

  return winner
end
