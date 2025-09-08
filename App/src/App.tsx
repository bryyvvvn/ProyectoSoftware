import React, {useState} from 'react';
import Form from './Login';
import Dashboard from './Dashboard';

const App: React.FC = () => {
    const[data, setData] = useState<any | null>(null);

    const handleSucces = (apiData: any) => {
        setData(apiData);
    };

    return data ? <Dashboard data={data} /> : <Form onSucces={handleSucces}/>
};

export default App;