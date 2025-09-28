import React, {useState} from 'react';
import Form from './pages/Login/Login';
import Malla from './pages/AvanceCurricular/Malla';

const App: React.FC = () => {
    const[data, setData] = useState<any | null>(null);

    const handleSucces = (apiData: any) => {
        setData(apiData);
    };

    return data ? <Malla data={data} /> : <Form onSucces={handleSucces}/>
};

export default App;