import requests
from bs4 import BeautifulSoup

def PlayerStatsFetch():
    
    url = "https://www.basketball-reference.com/leagues/NBA_2025_per_game.html"
    response = requests.get(url)
    
    if response.status_code == 200:
        page_content = response.text
        soup = BeautifulSoup(str(page_content), 'html.parser')
        tables = soup.find_all("table")   
        data=[]
        if tables:
            for table in tables:
                
                rows = table.find_all("tr") 
                for row in rows:
                    row_data = [cell.get_text() for cell in row.find_all(["th", "td"])]
                    data.append(row_data)
    else:
        print("Failed to retrieve the webpage.")
    return data





