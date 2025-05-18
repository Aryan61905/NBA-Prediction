
import requests
from bs4 import BeautifulSoup

def PlayByPlayFetch(token):
    
    url = f"https://www.basketball-reference.com/boxscores/pbp/{token}.html"
    response = requests.get(url)
    if response.status_code == 200:
        page_content = response.text
        soup = BeautifulSoup(str(page_content), 'html.parser')
        tables = soup.find_all("table")   
        data = []
        if tables:
            for table in tables:
                rows = table.find_all("tr") 
                for row in rows:
                    row_data = [cell.get_text() for cell in row.find_all(["th", "td"])]
                    if len(row_data) == 1:
                        title = row_data[0]

                    elif row_data[0]!= 'Time':   
                        if len(row_data) != 6:
                            row_data += [" "]*(6-len(row_data))
                        row_data = ['' if x == '\xa0' else x for x in row_data]
                        row_data = [x.replace('Ä\x87','c') for x in row_data]
                        row_data = [x.replace('Å\x86Ä£','ng') for x in row_data]
                        data.append([title]+row_data+[token])
    else:
        return response.status_code                 
                        
      
    
    

    return data
    
