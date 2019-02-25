/** @format */

import React, {useState} from 'react'
import Goban from 'react-goban-svg'
import clone from 'just-clone'

import user from './user'

// blank stonemap
const blankStonemap = []
for (let i = 0; i < 19; i++) {
  blankStonemap[i] = []
}
// ~

export default function Game({
  selectedGameData,
  setSelectedGameData,
  contractState
}) {
  let [selectedGame, setSelectedGame] = useState('')

  async function fetchGame() {
    let r = await fetch(
      `https://online-go.com/api/v1/games/${getGameId(selectedGame)}`
    )
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
      stonemap[x][y] = colors[i % 2]
    }
    setSelectedGameData({
      id: game.id,
      stonemap,
      black: game.gamedata.players.black.username,
      white: game.gamedata.players.white.username,
      offers: contractState.offers[game.id],
      userTokens: {
        black: contractState.tokens[game.id].black[user.id] || 0,
        white: contractState.tokens[game.id].white[user.id] || 0
      }
    })
  }

  return (
    <div id="game">
      <input
        onChange={e => setSelectedGame(e.target.value)}
        value={selectedGame}
        onBlur={fetchGame}
      />
      {selectedGameData && getGameId(selectedGame) == selectedGameData.id ? (
        <div className="wrapper">
          <Goban
            rows={19}
            cols={19}
            data={selectedGameData.stonemap}
            click={() => {}}
          />
          <div className="info">
            id:{' '}
            <a
              href={`https://online-go.com/game/${selectedGameData.id}`}
              target="_blank"
            >
              {selectedGameData.id}
            </a>
            black: {selectedGameData.black}
            white: {selectedGameData.white}
            <div>
              <strong>your tokens</strong>
              black: {selectedGameData.userTokens.black}
              white: {selectedGameData.userTokens.white}
            </div>
            <div>
              <strong>black open offers</strong>
              {selectedGameData.offers.black.map(({price, amount}) => (
                <span>
                  {amount} at {price} sats
                </span>
              ))}
            </div>
            <div>
              <strong>white open offers</strong>
              {selectedGameData.offers.white.map(({price, amount}) => (
                <span>
                  {amount} at {price} sats
                </span>
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
