import React from 'react'
import {useState} from 'react'
import {useEffect } from 'react';
import Car from './components/Car';

const App = () => {
  const [cars, setcars] = useState([]);

  useEffect(() => {
    fetch(' api/v1/cars')
      .then(response => response.json())
      .then(data => setcars(data))
      .catch(error => console.error('Error fetching cars:', error))
  }, []);

  return (
    <div>
      <h1>Hello, React!</h1>

      <ul>
        {cars.map(car => (
          <Car key={car.id} car={car} />
        ))}
      </ul>
    </div>
  )
}

export default App
