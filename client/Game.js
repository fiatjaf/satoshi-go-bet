/** @format */

import React, {useState, useEffect} from 'react'
import Goban from 'react-goban-svg'
import clone from 'just-clone'
import get from 'just-safe-get'

import * as toast from './toast'
import user from './user'
import {loadContract, makeCall, offersForGame, tokensForGame} from './contract'

// blank stonemap
const blankStonemap = []
for (let i = 0; i < 19; i++) {
  blankStonemap[i] = []
}
// ~

const OPENING_BET = 'OPENING_BET'
const MAKING_OFFER_FOR = 'MAKING_OFFER_FOR'
const BUYING_OFFER_FOR = 'BUYING_OFFER_FOR'
const NONE = 'NONE'

export default function Game({
  selectedGame,
  setSelectedGame,
  selectedGameData,
  setSelectedGameData,
  contractState,
  setContractState,
  showInvoice
}) {
  let [action, setAction] = useState({action: NONE})

  useEffect(
    () => {
      setAction({action: NONE})
    },
    [selectedGame]
  )

  useEffect(
    () => {
      if (!contractState || !selectedGameData) return () => {}

      var canceled = false
      let refresh = () => {
        if (!canceled && selectedGameData.status !== 'finished') {
          refreshGame()
          setTimeout(refresh, 10000)
        }
      }

      refresh()

      return () => {
        canceled = true
      }
    },
    [contractState]
  )

  async function refreshGame() {
    let data = await fetchGame(contractState, selectedGame)
    setSelectedGameData(data)
  }

  function handleStartOpeningBet(e) {
    e.preventDefault()
    setAction({action: OPENING_BET})
  }

  async function handleOpenBet(e) {
    e.preventDefault()

    try {
      await makeCall(
        'newbet',
        parseInt(e.target.satoshis.value),
        {gameid: getGameId(selectedGame), userid: user.id},
        {showInvoice}
      )
      toast.success('Bet made!')
      setContractState(await loadContract())
    } catch (e) {}
  }

  async function handleRedeem(e) {
    e.preventDefault()

    try {
      await makeCall(
        'redeem',
        0,
        {gameid: getGameId(selectedGame)},
        {showInvoice}
      )
      toast.success('Tokens redeemed!')
      setContractState(await loadContract())
    } catch (e) {}
  }

  function handleStartMakingOffer(e) {
    e.preventDefault()
    setAction({action: MAKING_OFFER_FOR, winner: e.target.dataset.winner})
  }

  async function handleMakeOffer(e) {
    e.preventDefault()

    try {
      await makeCall(
        'selloffer',
        0,
        {
          gameid: getGameId(selectedGame),
          winner: action.winner,
          price: e.target.price.value,
          amount: e.target.amount.value,
          userid: user.id,
          _key: user.key
        },
        {showInvoice}
      )
      toast.success('Offer created, now you must find a buyer.')
      setContractState(await loadContract())
    } catch (e) {}
  }

  async function handleUnoffer(e) {
    e.preventDefault()

    let gameid = getGameId(selectedGame)
    let winner = e.target.dataset.winner

    try {
      await makeCall(
        'unoffer',
        0,
        {
          gameid,
          winner,
          userid: user.id,
          _key: user.key
        },
        {showInvoice}
      )
      toast.success(`Offers for ${winner}@${gameid} were removed.`)
      setContractState(await loadContract())
    } catch (e) {}
  }

  function handleStartBuyingOffer(e) {
    e.preventDefault()
    setAction({action: BUYING_OFFER_FOR, winner: e.target.dataset.winner})
  }

  async function handleBuyOffer(e) {
    e.preventDefault()
    let winner = action.winner

    try {
      let {bought, spent} = await makeCall(
        'buyoffer',
        parseInt(e.target.satoshis.value),
        {
          gameid: getGameId(selectedGame),
          winner,
          maxprice: e.target.maxprice.value,
          userid: user.id
        },
        {showInvoice}
      )
      toast.success(
        `Bought ${bought} ${winner} tokens for a total of ${spent} satoshis.`
      )
      setContractState(await loadContract())
    } catch (e) {}
  }

  return (
    <div id="game">
      <p>
        You can choose any game from{' '}
        <a href="https://online-go.com/observe-games" target="_blank">
          this list
        </a>{' '}
        (you probably want correspondence games) and paste its URL or id here to
        start making bets.
      </p>
      <div className="game-input">
        <input
          onChange={e => setSelectedGame(e.target.value)}
          value={selectedGame}
          onBlur={refreshGame}
        />
        {selectedGameData ? <button onClick={refreshGame}>↻</button> : null}
      </div>
      {selectedGameData && getGameId(selectedGame) == selectedGameData.id ? (
        <div className="wrapper">
          <Goban
            rows={19}
            cols={19}
            data={selectedGameData.stonemap}
            click={() => {}}
          />
          <div className="info">
            <a
              href={`https://online-go.com/game/${selectedGameData.id}`}
              target="_blank"
            >
              game {selectedGameData.id}
            </a>
            <div>{selectedGameData.status}</div>
            <div>black: {selectedGameData.black}</div>
            <div>white: {selectedGameData.white}</div>
            {selectedGameData.status === 'finished' ? (
              <>
                <br />
                <div>
                  winner: <b>{selectedGameData.winner}</b>
                </div>
                {Object.keys(selectedGameData.tokens).length ||
                selectedGameData.offers.black.length ||
                selectedGameData.offers.white.length ? (
                  <button onClick={handleRedeem}>redeem tokens</button>
                ) : null}
                <br />
              </>
            ) : null}
            <br />
            <div>
              <strong>your tokens</strong>
              {['black', 'white'].map(winner => (
                <div key={winner}>
                  <span>
                    {winner}: {selectedGameData.userTokens[winner]}
                    {selectedGameData.userTotalOffered[winner] > 0 ? (
                      <>
                        {' '}
                        ({selectedGameData.userTotalOffered[winner]})
                        <button data-winner={winner} onClick={handleUnoffer}>
                          unoffer
                        </button>
                      </>
                    ) : null}
                  </span>
                  {selectedGameData.status === 'play' ? (
                    action.action === MAKING_OFFER_FOR &&
                    action.winner === winner ? (
                      <form onSubmit={handleMakeOffer}>
                        <label>
                          amount
                          <br />
                          <input
                            name="amount"
                            type="number"
                            step="1"
                            min="1"
                            defaultValue={selectedGameData.userTokens[winner]}
                          />
                        </label>
                        <label>
                          price
                          <br />
                          <input
                            name="price"
                            type="number"
                            step="1"
                            min="1"
                            max="9"
                            defaultValue="5"
                          />
                        </label>
                        <button>open offer</button>
                      </form>
                    ) : selectedGameData.userTokens[winner] ? (
                      <>
                        {' '}
                        <button
                          onClick={handleStartMakingOffer}
                          data-winner={winner}
                        >
                          sell
                        </button>
                      </>
                    ) : null
                  ) : null}
                </div>
              ))}
              {selectedGameData.status === 'play' ? (
                action.action === OPENING_BET ? (
                  <form onSubmit={handleOpenBet}>
                    <label>
                      satoshis to spend
                      <br />
                      <input name="satoshis" type="number" step="10" min="10" />
                    </label>
                    <button>bet</button>
                  </form>
                ) : (
                  <button onClick={handleStartOpeningBet}>open bet</button>
                )
              ) : null}
            </div>
            <br />
            <div>
              {['black', 'white'].map(winner => (
                <div key={winner}>
                  <strong>{winner} open offers</strong>
                  <div>
                    {selectedGameData.offers[winner] &&
                    selectedGameData.offers[winner].length !== 0 ? (
                      <>
                        {selectedGameData.offers[winner].map(
                          ({price, amount}, i) => (
                            <div key={i}>
                              {amount} tokens at {price}
                              sats each
                            </div>
                          )
                        )}
                        {selectedGameData.status === 'play' ? (
                          action.action === BUYING_OFFER_FOR &&
                          action.winner === winner ? (
                            <form onSubmit={handleBuyOffer}>
                              <label>
                                maxprice
                                <br />
                                <input
                                  name="maxprice"
                                  type="number"
                                  step="1"
                                  min="1"
                                  max="9"
                                  defaultValue="9"
                                />
                              </label>
                              <label>
                                total sats
                                <br />
                                <input type="number" name="satoshis" min="1" />
                              </label>
                              <button>send buy order</button>
                            </form>
                          ) : (
                            <button
                              data-winner={winner}
                              onClick={handleStartBuyingOffer}
                            >
                              buy
                            </button>
                          )
                        ) : null}
                      </>
                    ) : (
                      'none'
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function getGameId(gameIdOrURL) {
  try {
    return /\d\d\d\d\d+/.exec(gameIdOrURL)[0]
  } catch (e) {
    return ''
  }
}

export async function fetchGame(contractState, gameURL) {
  let gameId = getGameId(gameURL)
  if (!gameId || gameId.length === 0) return

  let r = await fetch(`https://online-go.com/api/v1/games/${gameId}`)
  if (!r.ok) {
    console.log('error: ' + (await r.text()))
    return
  }

  let game = await r.json()

  const colors =
    game.gamedata.initial_player === 'black' ? ['B', 'W'] : ['W', 'B']

  var stonemap = clone(blankStonemap)
  for (let i = 0; i < game.gamedata.moves.length; i++) {
    let [y, x] = game.gamedata.moves[i]
    if (x !== -1 && y !== -1) stonemap[x][y] = colors[i % 2]
  }

  return {
    id: game.id,
    stonemap,
    status: game.gamedata.phase,
    black: game.gamedata.players.black.username,
    white: game.gamedata.players.white.username,
    winner: game.black_lost ? 'white' : game.white_lost ? 'black' : null,
    offers: offersForGame(contractState, game.id),
    tokens: tokensForGame(contractState, game.id),
    userTokens: {
      black: get(contractState, ['tokens', game.id, 'black', user.id]) || 0,
      white: get(contractState, ['tokens', game.id, 'white', user.id]) || 0
    },
    userTotalOffered: {
      black: (get(contractState, ['offers', game.id, 'black']) || [])
        .filter(o => o.seller === user.id)
        .reduce((acc, o) => acc + o.amount, 0),
      white: (get(contractState, ['offers', game.id, 'white']) || [])
        .filter(o => o.seller === user.id)
        .reduce((acc, o) => acc + o.amount, 0)
    }
  }
}
