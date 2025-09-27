import React, {useState} from 'react';
import Form from './Login';
import Malla from './Malla';

const App: React.FC = () => {
    const[data, setData] = useState<any | null>(null);

    const handleSucces = (apiData: any) => {
        setData(apiData);
    };

    return data ? <Malla data={data} /> : <Form onSucces={handleSucces}/>
};

export default App;