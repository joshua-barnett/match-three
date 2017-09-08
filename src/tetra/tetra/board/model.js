import { TileMapModel } from 'tetra/tilemap'
import { CellModel } from 'tetra/cell'
import { TileModel, TileView } from 'tetra/tile'

export default class BoardModel extends TileMapModel {
  constructor (width, height, seed) {
    super(width, height)
    this._seed = seed
  }

  randomize () {
    for (let i = 0; i < this.size - this.width; i++) {
      let tileModel
      do {
        let position = this.transform1D(i)
        tileModel = this.createRandomTileModel()
        this.set(position.x, position.y, tileModel, true)
      } while (this.getVerticalMatches(tileModel).length > 2 || this.getHorizontalMatches(tileModel).length > 2)
    }
  }

  swapTiles (tile1, tile2) {
    if (!this._swapped) {
      this._swapped = tile1.swap(tile2)
        .then(() => {
          if (this.getMatches().length) {
            return this.simulate()
          } else {
            return tile1.swap(tile2)
          }
        })
        .then(() => {
          this._swapped = null
        })
    }
    return this._swapped
  }

  simulate () {
    return new Promise(resolve => {
      return Promise.all([
        this.removeAll(this.getMatches()),
        this.fill(),
        this.gravity()
      ]).then((processes) => {
        for (let process of processes) {
          if (process) {
            return this.simulate()
          }
        }
      }).then(resolve)
    })
  }

  removeAll (matches) {
    return new Promise(resolve => {
      for (let match of matches) {
        match.remove()
      }
      resolve(Boolean(matches.length))
    })
  }

  fill () {
    return new Promise(resolve => {
      let added = []
      let y = this.height - 1
      for (let x = 0; x < this.width; x++) {
        if (!this.get(x, y - 1)) {
          let tileModel = this.createRandomTileModel()
          this.set(x, y, tileModel)
          added.push(tileModel)
          if (this._onTileAdded) {
            this._onTileAdded(tileModel)
          }
        }
      }
      resolve(Boolean(added.length))
    })
  }

  gravity () {
    return new Promise(resolve => {
      let movements = []
      for (let i = 0; i < this._width; i++) {
        let drop = 0
        let cell = this.transform1D(i)
        while (cell.y <= this._height - 1) {
          if (!this.get(cell.x, cell.y)) {
            drop++
          } else if (drop) {
            movements.push(this.moveTile(cell, new CellModel(cell.x, cell.y - drop)))
          }
          cell.y++
        }
      }
      if (movements.length) {
        Promise.all(movements)
          .then(() => {
            resolve(true)
          })
      } else {
        resolve(false)
      }
    })
  }

  moveTile (fromCell, toCell) {
    return new Promise((resolve, reject) => {
      let movingTile = this.get(fromCell.x, fromCell.y)
      if (movingTile) {
        movingTile.move(toCell.x, toCell.y).then(() => {
          resolve()
        }, reject)
      } else {
        reject(new Error('Tile is moving'))
      }
    })
  }

  random () {
    let max = 1
    let min = 0
    this._seed = (this._seed * 9301 + 49297) % 233280
    let rnd = this._seed / 233280
    return min + rnd * (max - min)
  }

  createRandomTileModel () {
    return new TileModel(this.randomTileValue(0, Object.keys(TileView.IMAGES).length - 1), this)
  }

  randomTileValue (min, max) {
    return Math.floor(this.random() * (1 + max - min)) + min
  }

  static unique (tiles) {
    let unique = tiles.concat()
    for (let i = 0; i < unique.length; ++i) {
      for (let j = i + 1; j < unique.length; ++j) {
        if (unique[i].cell.equals(unique[j].cell)) {
          unique.splice(j--, 1)
        }
      }
    }
    return unique
  }

  getMatches () {
    let matches = []
    for (let tileModel of this) {
      let horizontalMatches = this.getHorizontalMatches(tileModel)
      if (horizontalMatches.length > 2) {
        matches = matches.concat(horizontalMatches)
      }
      let verticalMatches = this.getVerticalMatches(tileModel)
      if (verticalMatches.length > 2) {
        matches = matches.concat(verticalMatches)
      }
    }
    return BoardModel.unique(matches)
  }

  getVerticalMatches (tileModel) {
    let matches = [tileModel]
    let position = this.positionOf(tileModel)
    if (!tileModel || !position) {
      return matches
    }
    position.y--
    let nextTileModel = this.get(position.x, position.y)
    while (tileModel.equals(nextTileModel)) {
      matches.push(nextTileModel)
      position.y--
      nextTileModel = this.get(position.x, position.y)
    }
    position = this.positionOf(tileModel)
    position.y++
    nextTileModel = this.get(position.x, position.y)
    while (tileModel.equals(nextTileModel)) {
      matches.push(nextTileModel)
      position.y++
      nextTileModel = this.get(position.x, position.y)
    }
    return matches
  }

  getHorizontalMatches (tileModel) {
    let matches = [tileModel]
    let position = this.positionOf(tileModel)
    if (!tileModel || !position) {
      return matches
    }
    position.x--
    let nextTileModel = this.get(position.x, position.y)
    while (tileModel.equals(nextTileModel)) {
      matches.push(nextTileModel)
      position.x--
      nextTileModel = this.get(position.x, position.y)
    }
    position = this.positionOf(tileModel)
    position.x++
    nextTileModel = this.get(position.x, position.y)
    while (tileModel.equals(nextTileModel)) {
      matches.push(nextTileModel)
      position.x++
      nextTileModel = this.get(position.x, position.y)
    }
    return matches
  }

  static tilesMatch (tileModel1, tileModel2) {
    if (!tileModel1 || !tileModel2) {
      return false
    }
    return tileModel1.value === tileModel2.value
  }

  toString () {
    let string = ''
    for (let y = this.height - 1; y >= 0; y--) {
      for (let x = 0; x < this.width; x++) {
        let tileModel = this.get(x, y)
        string += tileModel ? tileModel.value : 'X'
        if (x === this._width - 1) {
          string += '\n'
        }
      }
    }
    return string
  }

  get size () {
    return this._vector.length
  }

  get width () {
    return this._width
  }

  get height () {
    return this._height
  }

  get onTileAdded () {
    return this._onTileAdded
  }

  set onTileAdded (value) {
    this._onTileAdded = value
    return this._onTileAdded
  }
}
