import React from 'react'

const car = ({ car }) => {
  return (
    <li>
      <p>Make: {car.make}</p>
      <p>Model:{car.model}</p>
      <p>Year: {car.year}</p>
      <p>Price:{car.price}</p>
    </li>
  )
}

export default car
